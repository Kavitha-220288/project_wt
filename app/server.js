require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8877;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Endpoint to provide Key ID to frontend
app.get('/get-key', (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID });
});

// Endpoint to create an order
app.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt = 'receipt_' + Date.now() } = req.body;

        const options = {
            amount: amount, // amount in paise
            currency: currency,
            receipt: receipt,
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Error creating order (Detailed):', JSON.stringify(error, null, 2));
        
        // Handle nested error objects from Razorpay SDK
        const details = error.error ? (error.error.description || error.error.reason) : (error.description || error.message);
        
        res.status(500).json({ 
            error: 'Razorpay Order Creation Failed', 
            details: details || JSON.stringify(error) || 'Unknown Razorpay error'
        });
    }
});

// Endpoint to verify payment
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, userId, itemName } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // ✅ Payment verified! Now sync with Walletly
            console.log(`Payment verified for ${itemName}. Syncing with Walletly...`);

            try {
                const walletlyResponse = await fetch('http://localhost:3002/api/payments/external-sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        amount: amount / 100, // Convert paise to INR for Walletly
                        userId: userId || 'test_user_001', // Fallback UID if not provided
                        secret: process.env.SYNC_SECRET || 'fallback_secret_change_me',
                        itemName: itemName || 'Universal Item',
                        merchant: 'Razorpay'
                    }),
                });

                if (walletlyResponse.ok) {
                    console.log('Walletly sync successful');
                    res.json({ status: 'success', message: 'Payment verified and synced' });
                } else {
                    const errorMsg = await walletlyResponse.json();
                    console.error('Walletly sync failed:', errorMsg);
                    res.status(400).json({ status: 'partial_success', message: 'Payment verified but sync failed', details: errorMsg });
                }
            } catch (syncError) {
                console.error('Walletly server offline or unreachable:', syncError.message);
                res.status(400).json({ status: 'partial_success', message: 'Payment verified but Walletly is offline', details: syncError.message });
            }
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).send(error);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
