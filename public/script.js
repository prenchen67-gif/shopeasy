const API_BASE = window.location.origin;

        const state = {
            products: [],
            filtered: [],
            currentCategory: 'all',
            selectedProduct: null,
            quantity: 1,
            cart: JSON.parse(localStorage.getItem('shopeasy-cart') || '[]')
        };

        function showStatus(message, type = 'info') {
            const box = document.getElementById('statusBox');
            box.textContent = message;
            box.className = 'status-box ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
            box.style.display = 'block';
        }

        function openCartDrawer() {
            renderCart();
            document.getElementById('cartDrawer').classList.add('open');
        }

        function closeCartDrawer() {
            document.getElementById('cartDrawer').classList.remove('open');
        }

        async function fetchProducts() {
            try {
                const res = await fetch(`${API_BASE}/api/products`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                state.products = Array.isArray(data) ? data : [];
                filterProducts(state.currentCategory);
                updateCartCount();
            } catch (error) {
                console.error('Product fetch failed:', error);
                showStatus('Products could not be loaded. Check backend status.', 'error');
            }
              }

        function filterProducts(category, button) {
            state.currentCategory = category;
            const buttons = document.querySelectorAll('.cat-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            if (button) button.classList.add('active');

            state.filtered = category === 'all'
                ? state.products
                : state.products.filter(item => String(item.category || '').toLowerCase() === category.toLowerCase());

            renderProducts();
        }

        function renderProducts() {
            const grid = document.getElementById('productsGrid');
            if (!state.filtered.length) {
                grid.innerHTML = '<div style="padding:20px; background:#fff; border-radius:12px; color:#666;">No products available.</div>';
                return;
            }

            grid.innerHTML = state.filtered.map(product => {
                const pId = product.id || product._id;
                return `
                <div class="product-card" onclick="openProductModal('${pId}')">
                    <img class="product-img" src="${product.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80'}" alt="${product.title}">
                    <div class="product-title">${product.title}</div>
                    <div class="product-price">৳ ${product.price}</div>
                    <button class="add-cart-small" onclick="event.stopPropagation(); addToCart('${pId}')">কার্টে যোগ</button>
                </div>
            `}).join('');
        }

    
        function openProductModal(productId) {
    const product = state.products.find(item => String(item.id || item._id) === String(productId));
    if (!product) return;
    state.selectedProduct = product;
    state.quantity = 1;
    
    document.getElementById('viewTitle').textContent = product.title;
    document.getElementById('viewPrice').textContent = '৳ ' + product.price;
    document.getElementById('viewDesc').textContent = product.desc || 'কোনো বিবরণ নেই।';
    document.getElementById('viewImage').src = product.image || '';

    // ১. সাইজ (Sizes) অ্যারে হ্যান্ডেল করার কোড
    const sizeSelect = document.getElementById('viewVariety'); 
    if (product.sizes && product.sizes.length > 0) {
        // যদি ডাটাবেজে sizes অ্যারে থাকে, তবে অপশন বানিয়ে দেব
        sizeSelect.innerHTML = product.sizes.map(s => `<option value="${s}">সাইজ: ${s}</option>`).join('');
    } else {
        sizeSelect.innerHTML = `<option value="N/A">Standard</option>`;
    }

    // ২. কালার (Color) অ্যারে হ্যান্ডেল করার কোড
    let colorContainer = document.getElementById('viewColorContainer');
    if (!colorContainer) {
        // যদি কালার ড্রপডাউন আগে থেকে না থাকে, তবে ডাইনামিক বানিয়ে দেব
        const varietyGroup = sizeSelect.closest('.option-group');
        const colorHtml = `
            <div class="option-group" id="viewColorContainer" style="margin-top:10px;">
                <label>কালার সিলেক্ট করুন:</label>
                <select id="viewColor"></select>
            </div>
        `;
        varietyGroup.insertAdjacentHTML('afterend', colorHtml);
        colorContainer = document.getElementById('viewColorContainer');
    }

    const colorSelect = document.getElementById('viewColor');
    if (product.color && product.color.length > 0) {
        // কালার অ্যারে বা স্ট্রিং হলে তা অপশনে রূপান্তর করা
        const colors = Array.isArray(product.color) ? product.color : product.color.split(',').map(c => c.trim());
        colorSelect.innerHTML = colors.map(c => `<option value="${c}">${c}</option>`).join('');
        colorContainer.style.display = 'block';
    } else {
        colorContainer.style.display = 'none';
    }

    document.getElementById('qtyValue').textContent = state.quantity;
    document.getElementById('productViewModal').style.display = 'flex';
        }
            

        function closeModal(id) {
            document.getElementById(id).style.display = 'none';
        }

        function changeQty(delta) {
            state.quantity = Math.max(1, state.quantity + delta);
            document.getElementById('qtyValue').textContent = state.quantity;
        }

        function addToCart(productId) {
            const product = state.products.find(item => String(item.id || item._id) === String(productId));
            if (!product) return;
            const pId = product.id || product._id;
            const existing = state.cart.find(item => String(item.id) === String(pId));
            if (existing) {
                existing.qty += 1;
            } else {
                state.cart.push({ id: pId, title: product.title, price: product.price, image: product.image, qty: 1 });
            }
            saveCart();
            alert('কার্টে যোগ করা হয়েছে!');
        }

        function saveCart() {
            localStorage.setItem('shopeasy-cart', JSON.stringify(state.cart));
            updateCartCount();
        }

        function updateCartCount() {
            const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
            document.getElementById('cartCount').textContent = count;
        }

        function renderCart() {
            const container = document.getElementById('cartItems');
            if (!state.cart.length) {
                container.innerHTML = '<div class="cart-empty">আপনার কার্ট খালি</div>';
                document.getElementById('cartTotal').textContent = 'মোট: ৳0';
                return;
            }

            let total = 0;
            container.innerHTML = state.cart.map(item => {
                total += Number(item.price) * item.qty;
                return `
                    <div class="cart-item">
                        <img src="${item.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80'}">
                        <div class="cart-item-info">
                            <div class="cart-item-title">${item.title}</div>
                            <div style="color:#ff6b6b; font-weight:bold;">৳ ${item.price}</div>
                        </div>
                        <div class="cart-item-controls">
                            <span>x${item.qty}</span>
                            <button onclick="removeFromCart('${item.id}')" style="color:red; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
            document.getElementById('cartTotal').textContent = `মোট: ৳${total}`;
        }

        function removeFromCart(id) {
            state.cart = state.cart.filter(item => String(item.id) !== String(id));
            saveCart();
            renderCart();
        }

        async function checkoutCart() {
            if (!state.cart.length) {
                alert('আপনার কার্ট খালি!');
                return;
            }
            alert('একটি প্রডাক্ট সিলেক্ট করে সরাসরি নাম, ফোন ও ঠিকানা দিয়ে অর্ডার করুন।');
        }

        async function submitOrder() {
    if (!state.selectedProduct) return;
    const customerName = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    
    // ১. সাইজ এবং কালার ড্রপডাউন থেকে ভ্যালু নেওয়া
    const sizeSelect = document.getElementById('viewVariety');
    const size = sizeSelect ? sizeSelect.value : 'N/A';

    const colorSelect = document.getElementById('viewColor');
    const color = colorSelect ? colorSelect.value : 'N/A';

    if (!customerName || !phone || !address) {
        alert('দয়া করে নাম, ফোন এবং ঠিকানা পূরণ করুন।');
        return;
    }

    // ২. সাইজ এবং কালার মিলিয়ে একটি স্ট্রিং তৈরি করা (যেমন: M / Color: Black)
    const selectedVariant = `Size: ${size} | Color: ${color}`;

    const orderData = {
        customerName,
        productName: state.selectedProduct.title,
        size: selectedVariant, // সাইজ ও কালার একসাথে পাঠানো হচ্ছে
        price: Number(state.selectedProduct.price) * Number(state.quantity),
        address,
        phone,
        txnId: 'COD-' + Math.floor(100000 + Math.random() * 900000)
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();
        if (response.ok) {
            alert('অর্ডার সফলভাবে সম্পন্ন হয়েছে!');
            closeModal('productViewModal');
            // ইনপুট ফিল্ডগুলো ক্লিয়ার করে দেওয়া
            document.getElementById('customerName').value = '';
            document.getElementById('customerPhone').value = '';
            document.getElementById('customerAddress').value = '';
        } else {
            alert('অর্ডার করতে সমস্যা হয়েছে: ' + (result.error || result.message));
        }
    } catch (err) {
        console.error('Order error:', err);
        alert('সার্ভারে সংযোগ স্থাপন করতে সমস্যা হচ্ছে!');
    }
        }
        

        function openAdminModal() {
            document.getElementById('adminModal').style.display = 'flex';
        }

        function switchAdminTab(tab) {
            document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            if (tab === 'login') {
                if (event && event.target) event.target.classList.add('active');
                document.getElementById('adminLoginTab').classList.add('active');
            } else if (tab === 'orders') {
                if (event && event.target) event.target.classList.add('active');
                document.getElementById('adminOrdersTab').classList.add('active');
                fetchAdminOrders();
            }
        }

        async function adminLogin() {
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;

            try {
                const res = await fetch(`${API_BASE}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');

                localStorage.setItem('shopeasy-token', data.token);
                alert('লগইন সফল হয়েছে!');

                document.querySelectorAll('.admin-tab-btn')[1].classList.add('active');
                document.querySelectorAll('.admin-tab-btn')[0].classList.remove('active');
                document.getElementById('adminLoginTab').classList.remove('active');
                document.getElementById('adminOrdersTab').classList.add('active');
                fetchAdminOrders();
            } catch (err) {
                alert('লগইন ব্যর্থ: ' + err.message);
            }
        }

        async function fetchAdminOrders() {
            const token = localStorage.getItem('shopeasy-token');
            if (!token) {
                alert('দয়া করে প্রথমে লগইন করুন।');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/api/admin/orders`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const orders = await res.json();
                const list = document.getElementById('ordersList');

                if (!Array.isArray(orders) || !orders.length) {
                    list.innerHTML = '<p style="padding:10px; color:#666;">কোনো অর্ডার পাওয়া যায়নি।</p>';
                    return;
                }

                list.innerHTML = orders.map(o => `
                    <div class="order-card">
                        <div class="order-header">
                            <span><b>#${o._id || o.id}</b> - ${o.customer_name}</span>
                            <span class="order-price">৳ ${o.price}</span>
                        </div>
                        <div class="order-body">
                            <p><b>প্রডাক্ট:</b> ${o.product}</p>
                            <p><b>ফোন:</b> ${o.phone}</p>
                            <p><b>ঠিকানা:</b> ${o.address}</p>
                        </div>
                    </div>
                `).join('');
            } catch (err) {
                console.error('Failed to fetch orders:', err);
            }
        }

        fetchProducts();
