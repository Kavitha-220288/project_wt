// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDBpprnuEhHMF8_pFKTdQI1J9lOMJwTa74",
    authDomain: "expense-tracker-c3176.firebaseapp.com",
    projectId: "expense-tracker-c3176",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 2. Global State
let currentUID = null;
const statusMessage = document.getElementById('status-message');
const loginOverlay = document.getElementById('login-overlay');
const marketplaceContainer = document.getElementById('marketplace-container');
const userEmailDisplay = document.getElementById('user-email-display');
const API_URL = window.location.origin;

// 3. Monitor Auth State
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Logged in as:", user.email);
        currentUID = user.uid;
        userEmailDisplay.innerText = user.email;
        
        // Show Marketplace, Hide Login
        loginOverlay.style.display = 'none';
        marketplaceContainer.style.display = 'block';
    } else {
        console.log("Not logged in.");
        currentUID = null;
        
        // Hide Marketplace, Show Login
        loginOverlay.style.display = 'flex';
        marketplaceContainer.style.display = 'none';
    }
});

// 4. Handle Login Form
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, pass)
        .catch(err => {
            alert("Login Failed: " + err.message);
        });
});

// Added Google Auth
document.getElementById('google-login-btn').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("Success login:", result.user.email);
        })
        .catch((error) => {
            console.error("Auth error:", error.message);
            alert("Google Sign-In failed.");
        });
});

// 5. Handle Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
});

// 6. Razorpay Payment Logic
document.querySelectorAll('.pay-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
        if (!currentUID) {
            alert("Please login first!");
            return;
        }

        const productCard = e.target.closest('.product-card');
        const productName = productCard.getAttribute('data-name');
        const productPrice = parseInt(productCard.getAttribute('data-price'));

        try {
            // Step 1: Get the key id from backend
            const keyResponse = await fetch(`${API_URL}/get-key`);
            const { key } = await keyResponse.json();

            if (!key || key === 'rzp_test_...') {
                showStatus('Razorpay Key ID missing! Update .env', 'error');
                return;
            }

            // Step 2: Create an order from the backend
            const orderResponse = await fetch(`${API_URL}/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: productPrice,
                    currency: 'INR',
                    receipt: `rcpt_${productName.substring(0, 10).replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`
                }),
            });

            if (!orderResponse.ok) {
                const errorDetails = await orderResponse.json();
                const errorMessage = typeof errorDetails.details === 'object' ? JSON.stringify(errorDetails.details) : (errorDetails.details || 'Failed to create order');
                throw new Error(errorMessage);
            }

            const order = await orderResponse.json();

            // Step 3: Open Razorpay checkout
            const options = {
                key: key,
                amount: order.amount,
                currency: order.currency,
                name: 'Universal Marketplace',
                description: `Payment for ${productName}`,
                order_id: order.id,
                handler: async function (response) {
                    // Step 4: Verify the payment and sync with Walletly
                    verifyPayment(productName, {
                        ...response,
                        amount: productPrice,
                        userId: currentUID, // DYNAMICALLY using the logged-in Firebase UID
                        itemName: productName // ADDED THIS to send the item name
                    });
                },
                prefill: {
                    name: auth.currentUser.displayName || 'Guest User',
                    email: auth.currentUser.email,
                },
                theme: { color: '#6366f1' },
            };

            const rzp1 = new Razorpay(options);
            rzp1.open();

            rzp1.on('payment.failed', function (response) {
                showStatus(`Payment failed: ${response.error.description}`, 'error');
            });

        } catch (error) {
            console.error('Error in payment process:', error);
            showStatus('Error: ' + error.message, 'error');
        }
    });
});

async function verifyPayment(productName, paymentDetails) {
    try {
        const verifyResponse = await fetch(`${API_URL}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentDetails),
        });

        const result = await verifyResponse.json();

        if (result.status === 'success') {
            showStatus(`Success! Purchased ${productName} ✨`, 'success');
            const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-30.mp3');
            audio.play();
        } else if (result.status === 'partial_success') {
            showStatus(`Payment OK, but Sync failed: ${result.message}`, 'error');
            console.error('Sync Error Details:', result.details);
        } else {
            showStatus('Payment verification failed.', 'error');
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        showStatus('Error verifying payment. Check console.', 'error');
    }
}

function showStatus(message, type) {
    statusMessage.innerText = message;
    statusMessage.className = 'status-message ' + (type === 'success' ? 'status-success' : 'status-error');
    statusMessage.style.display = 'block';
    setTimeout(() => { statusMessage.style.display = 'none'; }, 5000);
}
