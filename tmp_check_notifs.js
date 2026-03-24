console.log('Script started');
const admin = require('firebase-admin');
console.log('firebase-admin loaded');
const serviceAccount = require('c:\\Users\\n2205\\Desktop\\walletly\\project_wt\\server\\expense-tracker-c3176-firebase-adminsdk-fbsvc-d1beeb1e6f.json');
console.log('Service account loaded');

if (!admin.apps.length) {
  console.log('Initializing admin app...');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Admin app initialized');
}

const db = admin.firestore();

async function checkNotifications() {
  try {
    const snapshot = await db.collection('notifications').limit(5).get();
    if (snapshot.empty) {
      console.log('No notifications found in the database.');
    } else {
      console.log('Found ' + snapshot.size + ' notifications:');
      snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
      });
    }

    // Try creating a test notification for a user
    // I'll look for a user first
    const users = await db.collection('users').limit(1).get();
    if (!users.empty) {
      const userId = users.docs[0].id;
      console.log('Found a test user:', userId);
      
      const testNotif = {
        userId: userId,
        title: 'System Test 🛠️',
        message: 'This is a test notification at ' + new Date().toISOString(),
        type: 'test',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('notifications').add(testNotif);
      console.log('Successfully created a test notification with ID:', docRef.id);
    } else {
      console.log('No users found to send a test notification.');
    }

  } catch (error) {
    console.error('Error checking notifications:', error);
  } finally {
    process.exit();
  }
}

checkNotifications();
