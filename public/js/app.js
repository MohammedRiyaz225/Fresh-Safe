const FS = (function() {
  const STORAGE_KEYS = {
    CART: 'fs_cart',
    USER: 'fs_user',
    TOKEN: 'fs_token',
    ORDERS: 'fs_orders',
    WALLET: 'fs_wallet',
    LOYALTY: 'fs_loyalty',
    ADDRESSES: 'fs_addresses',
    SUBSCRIPTIONS: 'fs_subs',
    WISHLIST: 'fs_wishlist',
    RECENT: 'fs_recent'
  };

  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function uid() { return 'FS' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8).toUpperCase(); }

  // ============ CART ============
  const Cart = {
    get() {
      const cart = storageGet(STORAGE_KEYS.CART, []);
      if (!Array.isArray(cart)) return [];
      let migrated = false;
      cart.forEach(item => {
        if (item && typeof item === 'object' && !item.id) {
          item.id = uid();
          migrated = true;
        }
      });
      if (migrated) storageSet(STORAGE_KEYS.CART, cart);
      return cart;
    },
    set(cart) { storageSet(STORAGE_KEYS.CART, cart); this.updateBadge(); },
    add(item) {
      const cart = this.get();
      const idx = cart.findIndex(i => i.name === item.name);
      if (idx > -1) cart[idx].qty += (item.qty || 1);
      else cart.push({ ...item, qty: item.qty || 1, id: uid() });
      this.set(cart);
      this._animateBadge();
      return cart;
    },
    remove(idOrName) {
      let cart = this.get();
      cart = cart.filter(i => i.id !== idOrName && i.name !== idOrName);
      this.set(cart);
      return cart;
    },
    updateQty(id, qty) {
      const cart = this.get();
      const idx = cart.findIndex(i => i.id === id);
      if (idx > -1) {
        if (qty <= 0) cart.splice(idx, 1);
        else cart[idx].qty = qty;
        this.set(cart);
      }
      return cart;
    },
    clear() { this.set([]); },
    count() { return this.get().reduce((s, i) => s + i.qty, 0); },
    subtotal() { return this.get().reduce((s, i) => s + (i.price * i.qty), 0); },
    deliveryFee() { return this.subtotal() >= 499 ? 0 : 49; },
    tax() { return Math.round(this.subtotal() * 0.05); },
    total() { return this.subtotal() + this.deliveryFee() + this.tax(); },
    updateBadge() {
      const count = this.count();
      document.querySelectorAll('[data-cart-count]').forEach(el => {
        el.textContent = count;
      });
      document.querySelectorAll('#cartCount').forEach(el => {
        el.textContent = count;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = '';
      });
    },
    _animateBadge() {
      const btn = document.getElementById('cartNavBtn');
      if (!btn) return;
      btn.style.animation = 'none';
      btn.offsetHeight;
      btn.style.animation = 'cartBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)';
    }
  };

  // ============ AUTH / USER ============
  const Auth = {
    currentUser() { return storageGet(STORAGE_KEYS.USER, null); },
    getToken() { return localStorage.getItem(STORAGE_KEYS.TOKEN); },
    isLoggedIn() { return !!this.currentUser() && !!this.getToken(); },
    register(data) {
      const users = storageGet('fs_users_db', []);
      if (users.find(u => u.email === data.email)) {
        return { ok: false, message: 'Email already registered' };
      }
      const user = {
        id: uid(),
        name: data.name || data.username,
        email: data.email,
        phone: data.phone || '',
        password: data.password,
        createdAt: new Date().toISOString(),
        tier: 'Bronze',
        avatar: null
      };
      users.push(user);
      storageSet('fs_users_db', users);
      return this._createSession(user);
    },
    login(identifier, password) {
      const users = storageGet('fs_users_db', []);
      const user = users.find(u => (u.email === identifier || u.name === identifier) && u.password === password);
      if (!user) return { ok: false, message: 'Invalid credentials' };
      return this._createSession(user);
    },
    logout() {
      storageRemove(STORAGE_KEYS.USER);
      storageRemove(STORAGE_KEYS.TOKEN);
      FS.Toast.show('Logged out successfully');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    },
    _createSession(user) {
      const { password, ...safeUser } = user;
      const token = 'tk_' + uid() + uid().slice(2);
      storageSet(STORAGE_KEYS.USER, safeUser);
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      this._initUserDefaults(safeUser.id);
      return { ok: true, user: safeUser, token };
    },
    _initUserDefaults(userId) {
      if (!storageGet(STORAGE_KEYS.WALLET)) storageSet(STORAGE_KEYS.WALLET, { balance: 150, transactions: [] });
      if (!storageGet(STORAGE_KEYS.LOYALTY)) storageSet(STORAGE_KEYS.LOYALTY, { points: 0, level: 1, totalSpent: 0 });
      if (!storageGet(STORAGE_KEYS.ADDRESSES)) storageSet(STORAGE_KEYS.ADDRESSES, []);
      if (!storageGet(STORAGE_KEYS.ORDERS)) storageSet(STORAGE_KEYS.ORDERS, []);
      if (!storageGet(STORAGE_KEYS.SUBSCRIPTIONS)) storageSet(STORAGE_KEYS.SUBSCRIPTIONS, []);
      if (!storageGet(STORAGE_KEYS.WISHLIST)) storageSet(STORAGE_KEYS.WISHLIST, []);
    },
    updateProfile(updates) {
      const user = this.currentUser();
      if (!user) return null;
      const merged = { ...user, ...updates };
      storageSet(STORAGE_KEYS.USER, merged);
      const users = storageGet('fs_users_db', []);
      const idx = users.findIndex(u => u.id === user.id);
      if (idx > -1) { users[idx] = { ...users[idx], ...updates }; storageSet('fs_users_db', users); }
      return merged;
    }
  };

  // ============ ORDERS ============
  const Orders = {
    list() { return storageGet(STORAGE_KEYS.ORDERS, []); },
    get(id) { return this.list().find(o => o.id === id); },
    place(orderData) {
      const cart = Cart.get();
      if (!cart.length) return { ok: false, message: 'Cart is empty' };
      const order = {
        id: 'ORD' + Date.now().toString(36).toUpperCase(),
        items: cart,
        subtotal: Cart.subtotal(),
        deliveryFee: Cart.deliveryFee(),
        tax: Cart.tax(),
        total: Cart.total(),
        status: 'Placed',
        statusHistory: [
          { status: 'Placed', time: new Date().toISOString(), note: 'Order received successfully' },
          { status: 'Packing', time: new Date(Date.now() + 10*60000).toISOString(), note: 'Items being packed at facility', estimated: true },
          { status: 'Out for Delivery', time: new Date(Date.now() + 60*60000).toISOString(), note: 'With our delivery partner', estimated: true },
          { status: 'Delivered', time: new Date(Date.now() + 210*60000).toISOString(), note: 'Handed to customer', estimated: true }
        ],
        address: orderData.address,
        paymentMethod: orderData.paymentMethod,
        promoUsed: orderData.promoUsed || null,
        discount: orderData.discount || 0,
        customer: Auth.currentUser() ? { id: Auth.currentUser().id, name: Auth.currentUser().name, email: Auth.currentUser().email } : orderData.guestInfo,
        createdAt: new Date().toISOString(),
        deliverySlot: orderData.deliverySlot || 'Today, 4 PM - 7 PM',
        rider: { name: 'Rajesh Kumar', phone: '+91 98765 43210', rating: 4.9, avatar: 'https://randomuser.me/api/portraits/men/75.jpg' }
      };
      const orders = this.list();
      orders.unshift(order);
      storageSet(STORAGE_KEYS.ORDERS, orders);

      const loyalty = Loyalty.get();
      const earned = Math.round(order.total / 10);
      loyalty.points += earned;
      loyalty.totalSpent += order.total;
      if (loyalty.totalSpent >= 5000) { loyalty.level = 3; Auth.updateProfile({ tier: 'Gold' }); }
      else if (loyalty.totalSpent >= 1500) { loyalty.level = 2; Auth.updateProfile({ tier: 'Silver' }); }
      Loyalty.set(loyalty);

      if (orderData.useWallet) {
        const wallet = Wallet.get();
        wallet.balance = Math.max(0, wallet.balance - order.total);
        wallet.transactions.unshift({ id: uid(), type: 'debit', amount: order.total, note: `Order ${order.id}`, time: new Date().toISOString() });
        Wallet.set(wallet);
      }

      Cart.clear();
      FS.Toast.show('🎉 Order ' + order.id + ' placed successfully! +' + earned + ' points');
      return { ok: true, order, earnedPoints: earned };
    },
    cancel(id) {
      const orders = this.list();
      const idx = orders.findIndex(o => o.id === id);
      if (idx === -1) return null;
      orders[idx].status = 'Cancelled';
      orders[idx].statusHistory.push({ status: 'Cancelled', time: new Date().toISOString(), note: 'Order cancelled by customer' });
      storageSet(STORAGE_KEYS.ORDERS, orders);
      const wallet = Wallet.get();
      wallet.balance += Math.round(orders[idx].total * 0.95);
      wallet.transactions.unshift({ id: uid(), type: 'credit', amount: Math.round(orders[idx].total * 0.95), note: `Refund for ${id} (95%)`, time: new Date().toISOString() });
      Wallet.set(wallet);
      FS.Toast.show('Order cancelled. 95% refunded to wallet');
      return orders[idx];
    }
  };

  // ============ WALLET ============
  const Wallet = {
    get() { return storageGet(STORAGE_KEYS.WALLET, { balance: 0, transactions: [] }); },
    set(w) { storageSet(STORAGE_KEYS.WALLET, w); },
    add(amount, note = 'Top-up') {
      const w = this.get();
      w.balance += amount;
      w.transactions.unshift({ id: uid(), type: 'credit', amount, note, time: new Date().toISOString() });
      this.set(w);
      return w;
    }
  };

  // ============ LOYALTY ============
  const Loyalty = {
    get() { return storageGet(STORAGE_KEYS.LOYALTY, { points: 0, level: 1, totalSpent: 0 }); },
    set(l) { storageSet(STORAGE_KEYS.LOYALTY, l); },
    tierName() { const l = this.get().level; return ['Bronze', 'Silver', 'Gold'][l-1] || 'Bronze'; },
    nextTierPoints() { const l = this.get().level; return l === 1 ? 1500 : l === 2 ? 5000 : null; }
  };

  // ============ ADDRESSES ============
  const Addresses = {
    list() { return storageGet(STORAGE_KEYS.ADDRESSES, []); },
    add(addr) {
      const list = this.list();
      addr.id = uid();
      if (!list.length) addr.default = true;
      list.push(addr);
      storageSet(STORAGE_KEYS.ADDRESSES, list);
      return addr;
    },
    remove(id) {
      let list = this.list().filter(a => a.id !== id);
      storageSet(STORAGE_KEYS.ADDRESSES, list);
    },
    setDefault(id) {
      const list = this.list();
      list.forEach(a => a.default = (a.id === id));
      storageSet(STORAGE_KEYS.ADDRESSES, list);
    }
  };

  // ============ SUBSCRIPTIONS ============
  const Subscriptions = {
    list() { return storageGet(STORAGE_KEYS.SUBSCRIPTIONS, []); },
    create(sub) {
      const list = this.list();
      sub.id = uid();
      sub.status = 'Active';
      sub.createdAt = new Date().toISOString();
      sub.nextDelivery = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      list.push(sub);
      storageSet(STORAGE_KEYS.SUBSCRIPTIONS, list);
      FS.Toast.show('✨ Subscription created! 5% discount applied');
      return sub;
    },
    cancel(id) {
      const list = this.list();
      const idx = list.findIndex(s => s.id === id);
      if (idx > -1) { list[idx].status = 'Cancelled'; storageSet(STORAGE_KEYS.SUBSCRIPTIONS, list); FS.Toast.show('Subscription cancelled'); }
    }
  };

  // ============ WISHLIST ============
  const Wishlist = {
    list() { return storageGet(STORAGE_KEYS.WISHLIST, []); },
    has(name) { return this.list().some(i => i.name === name); },
    add(item) {
      const list = this.list();
      if (this.has(item.name)) return;
      list.push({ ...item, addedAt: new Date().toISOString() });
      storageSet(STORAGE_KEYS.WISHLIST, list);
      FS.Toast.show('❤️ Added to wishlist');
    },
    remove(name) {
      storageSet(STORAGE_KEYS.WISHLIST, this.list().filter(i => i.name !== name));
      FS.Toast.show('Removed from wishlist');
    }
  };

  // ============ RECENT VIEWED ============
  const Recent = {
    list() { return storageGet(STORAGE_KEYS.RECENT, []); },
    add(item) {
      let list = this.list().filter(i => i.name !== item.name);
      list.unshift(item);
      list = list.slice(0, 10);
      storageSet(STORAGE_KEYS.RECENT, list);
    }
  };

  // ============ TOAST ============
  const Toast = {
    _el: null,
    _ensure() {
      if (!this._el) {
        this._el = document.getElementById('toast');
        if (!this._el) {
          const t = document.createElement('div');
          t.id = 'toast';
          t.className = 'toast';
          t.innerHTML = `<div class="toast-icon-check"><i class="fa fa-check"></i></div><span id="toastMsg">Notification</span>`;
          document.body.appendChild(t);
          const styleEl = document.createElement('style');
          styleEl.textContent = `
          .toast{position:fixed;bottom:28px;right:28px;z-index:9999;background:rgba(13,31,14,0.96);backdrop-filter:blur(16px) saturate(180%);color:white;padding:14px 22px;border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,0.18);display:flex;align-items:center;gap:12px;font-size:0.9rem;transform:translateX(130%);transition:transform 0.5s cubic-bezier(0.34,1.56,0.64,1);border:1px solid rgba(138,227,124,0.2);font-family:'Inter',sans-serif;max-width:360px}
          .toast.show{transform:translateX(0)}
          .toast-icon-check{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#2e7d32,#8ae37c);display:flex;align-items:center;justify-content:center;animation:checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;flex-shrink:0}
          @keyframes checkPop{0%{transform:scale(0) rotate(-180deg)}100%{transform:scale(1) rotate(0)}}
          @keyframes cartBounce{0%,100%{transform:scale(1)}30%{transform:scale(1.1) translateY(-4px)}60%{transform:scale(0.95)}}`;
          document.head.appendChild(styleEl);
          this._el = t;
        }
      }
    },
    show(msg, type = 'success', duration = 3200) {
      this._ensure();
      const t = this._el;
      const msgEl = t.querySelector('#toastMsg');
      if (msgEl) msgEl.textContent = msg;
      const icon = t.querySelector('.toast-icon-check i');
      if (icon) {
        icon.className = type === 'error' ? 'fa fa-times' : type === 'info' ? 'fa fa-info' : 'fa fa-check';
      }
      t.classList.remove('show');
      t.offsetHeight;
      t.classList.add('show');
      clearTimeout(this._t);
      this._t = setTimeout(() => t.classList.remove('show'), duration);
    }
  };

  // ============ NAVBAR ACCOUNT ============
  const NavAccount = {
    render(containerId = 'navAccount') {
      const container = document.getElementById(containerId);
      if (!container) return;
      const user = Auth.currentUser();
      if (user) {
        const tierColors = { Bronze: 'linear-gradient(135deg,#cd7f32,#b87333)', Silver: 'linear-gradient(135deg,#c0c0c0,#a0a0a0)', Gold: 'linear-gradient(135deg,#f9a825,#fdd835)' };
        const tierColor = tierColors[user.tier] || tierColors.Bronze;
        const initials = (user.name || 'U').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);
        container.innerHTML = `
          <div class="nav-account" id="navAccountWrap">
            <button class="account-btn magnetic ripple-container" id="accountBtn" aria-haspopup="true">
              <div class="account-avatar" style="background:${tierColor}">${initials}</div>
              <div class="account-info">
                <div class="account-name">${user.name}</div>
                <div class="account-tier"><i class="fa fa-crown"></i> ${user.tier}</div>
              </div>
              <i class="fa fa-chevron-down account-caret"></i>
            </button>
            <div class="account-dropdown" id="accountDropdown" role="menu">
              <div class="dd-header">
                <div class="dd-avatar" style="background:${tierColor}">${initials}</div>
                <div>
                  <div class="dd-name">${user.name}</div>
                  <div class="dd-email">${user.email}</div>
                  <div class="dd-tier" style="background:${tierColor}"><i class="fa fa-crown"></i> ${user.tier} Member</div>
                </div>
              </div>
              <div class="dd-loyalty">
                <div class="dd-loyalty-row"><span><i class="fa fa-coins"></i> Loyalty Points</span><strong>${Loyalty.get().points}</strong></div>
                <div class="dd-loyalty-row"><span><i class="fa fa-wallet"></i> Wallet Balance</span><strong>₹${Wallet.get().balance}</strong></div>
              </div>
              <div class="dd-menu">
                <a href="dashboard.html" class="dd-item" role="menuitem"><i class="fa fa-gauge-high"></i><span>Dashboard</span></a>
                <a href="dashboard.html#orders" class="dd-item" role="menuitem"><i class="fa fa-box"></i><span>My Orders</span><em>${Orders.list().length}</em></a>
                <a href="dashboard.html#subscriptions" class="dd-item" role="menuitem"><i class="fa fa-repeat"></i><span>Subscriptions</span></a>
                <a href="dashboard.html#addresses" class="dd-item" role="menuitem"><i class="fa fa-location-dot"></i><span>Saved Addresses</span></a>
                <a href="dashboard.html#wishlist" class="dd-item" role="menuitem"><i class="fa fa-heart"></i><span>Wishlist</span><em>${Wishlist.list().length}</em></a>
                <a href="dashboard.html#profile" class="dd-item" role="menuitem"><i class="fa fa-user-pen"></i><span>Edit Profile</span></a>
              </div>
              <div class="dd-footer">
                <button class="dd-logout" id="ddLogout" role="menuitem"><i class="fa fa-right-from-bracket"></i> Log Out</button>
              </div>
            </div>
          </div>`;
        const btn = document.getElementById('accountBtn');
        const dd = document.getElementById('accountDropdown');
        const logoutBtn = document.getElementById('ddLogout');
        if (btn && dd) {
          btn.addEventListener('click', (e) => { e.stopPropagation(); dd.classList.toggle('open'); });
          document.addEventListener('click', (e) => {
            if (!dd.contains(e.target) && !btn.contains(e.target)) dd.classList.remove('open');
          });
        }
        if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());
      } else {
        container.innerHTML = `
          <a href="sign in.html" class="signin-btn magnetic ripple-container" id="navSignInBtn">
            <i class="fa fa-user"></i> Sign In
          </a>`;
      }

      const styleId = 'nav-account-style';
      if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
        .nav-account{position:relative}
        .account-btn{display:flex;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:999px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(10px);color:white;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);cursor:pointer}
        .navbar:not(.scrolled) .account-btn{background:rgba(46,125,50,0.08);border-color:rgba(46,125,50,0.18);color:var(--text-mid)}
        .account-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.12)}
        .account-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.8rem;font-family:'Outfit',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2)}
        .account-info{text-align:left;line-height:1.1}
        .account-name{font-weight:600;font-size:0.82rem}
        .account-tier{font-size:0.68rem;opacity:0.85;display:flex;align-items:center;gap:4px;margin-top:2px}
        .account-caret{font-size:0.65rem;opacity:0.7}
        .account-dropdown{position:absolute;top:calc(100% + 10px);right:0;width:320px;background:rgba(255,255,255,0.98);backdrop-filter:blur(24px) saturate(180%);border-radius:22px;box-shadow:0 24px 64px rgba(0,0,0,0.18);border:1px solid rgba(138,227,124,0.25);overflow:hidden;opacity:0;visibility:hidden;transform:translateY(-8px) scale(0.98);transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);z-index:10000}
        .account-dropdown.open{opacity:1;visibility:visible;transform:translateY(0) scale(1)}
        .dd-header{display:flex;gap:14px;padding:20px;background:linear-gradient(135deg,#0a2e0f,#103214);color:white}
        .dd-avatar{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-family:'Outfit',sans-serif;font-size:1.1rem;flex-shrink:0;box-shadow:0 4px 16px rgba(0,0,0,0.3)}
        .dd-name{font-weight:700;font-family:'Outfit',sans-serif;margin-bottom:2px}
        .dd-email{font-size:0.78rem;opacity:0.8}
        .dd-tier{display:inline-flex;align-items:center;gap:5px;font-size:0.7rem;padding:3px 10px;border-radius:999px;margin-top:6px;font-weight:700;color:white}
        .dd-loyalty{padding:14px 20px;background:#f1faf2;border-bottom:1px solid rgba(138,227,124,0.2)}
        .dd-loyalty-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:0.85rem;color:var(--text-mid)}
        .dd-loyalty-row strong{color:var(--green-bright);font-family:'Outfit',sans-serif;font-weight:800}
        .dd-loyalty-row i{margin-right:6px;color:var(--green-bright)}
        .dd-menu{padding:8px}
        .dd-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;color:var(--text-mid);font-size:0.88rem;font-weight:500;transition:all 0.2s ease;position:relative}
        .dd-item:hover{background:rgba(138,227,124,0.15);color:var(--green-bright);transform:translateX(4px)}
        .dd-item i{width:20px;text-align:center;color:var(--green-bright)}
        .dd-item em{position:absolute;right:14px;background:var(--green-bright);color:white;font-size:0.68rem;font-style:normal;padding:2px 8px;border-radius:999px;font-weight:700}
        .dd-footer{padding:12px 16px;border-top:1px solid rgba(138,227,124,0.2)}
        .dd-logout{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:14px;background:rgba(229,57,53,0.08);color:#c62828;font-weight:600;font-size:0.88rem;cursor:pointer;transition:all 0.2s ease;border:none}
        .dd-logout:hover{background:rgba(229,57,53,0.15);transform:translateY(-2px)}`;
        document.head.appendChild(s);
      }
    }
  };

  // ============ PROMO CODES ============
  const Promo = {
    codes: {
      FRESH20: { pct: 20, min: 499, label: '20% off (new user)' },
      SAVE100: { flat: 100, min: 999, label: '₹100 off' },
      SUBS5: { pct: 5, label: '5% subscriber discount', subOnly: true },
      LOYALTY10: { pct: 10, minPoints: 500, label: '10% off (Gold/Silver)' }
    },
    apply(code, total) {
      const p = this.codes[code.toUpperCase()];
      if (!p) return { ok: false, message: 'Invalid promo code' };
      if (p.min && total < p.min) return { ok: false, message: `Min order ₹${p.min} required` };
      if (p.subOnly && !Subscriptions.list().some(s => s.status === 'Active')) return { ok: false, message: 'Active subscription required' };
      if (p.minPoints && Loyalty.get().points < p.minPoints) return { ok: false, message: `${p.minPoints}+ loyalty points required` };
      let discount = p.flat || Math.round(total * p.pct / 100);
      if (p.pct) discount = Math.min(discount, 300);
      return { ok: true, discount, label: p.label };
    }
  };

  // ============ COMMON UI INIT ============
  function initCommonUI() {
    Cart.updateBadge();

    const style = document.createElement('style');
    style.textContent = `
    @keyframes cartBounce{0%,100%{transform:scale(1)}30%{transform:scale(1.1) translateY(-4px)}60%{transform:scale(0.95)}}
    `;
    document.head.appendChild(style);
  }

  window.addEventListener('DOMContentLoaded', initCommonUI);

  return {
    Cart, Auth, Orders, Wallet, Loyalty, Addresses, Subscriptions, Wishlist, Recent, Toast, Promo, NavAccount,
    uid, storageGet, storageSet
  };
})();

window.FS = FS;
window.addToCart = function(name, weight, price, img) {
  FS.Cart.add({ name, weight, price, img });
  FS.Toast.show('🛒 ' + name + ' added to cart!');
  FS.Recent.add({ name, weight, price, img });
};
window.toggleWishlist = function(name, weight, price, img) {
  if (FS.Wishlist.has(name)) FS.Wishlist.remove(name);
  else FS.Wishlist.add({ name, weight, price, img });
};
window.subscribeNewsletter = function() {
  const input = document.getElementById('newsletterEmail');
  if (!input) return;
  const email = input.value;
  if (!email || !email.includes('@')) { FS.Toast.show('Enter a valid email', 'error'); return; }
  FS.Toast.show('🎉 Subscribed! Fresh deals coming your way!');
  input.value = '';
};
