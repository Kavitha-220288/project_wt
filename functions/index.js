/**
 * Cloud Functions for FinBuddy
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Monthly Reset: Runs on the 1st of every month at midnight
exports.monthlyReset = functions.pubsub.schedule('1 of month 00:00').onRun(async (context) => {
    const usersSnap = await db.collection('users').get();
    const batch = db.batch();

    usersSnap.forEach(doc => {
        batch.update(doc.ref, { monthlySpent: 0 });
    });

    await batch.commit();
    console.log('Monthly budget reset completed for all users.');
    return null;
});

// Real-time Budget Alerts: Check budget whenever an expense is added
exports.checkBudgetUsage = functions.firestore
    .document('users/{userId}/expenses/{expenseId}')
    .onCreate(async (snap, context) => {
        const expense = snap.data();
        const userId = context.params.userId;
        
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        const newSpent = (userData.monthlySpent || 0) + expense.amount;
        await userRef.update({ monthlySpent: newSpent });

        if (userData.budget && newSpent > userData.budget) {
            // Here you would trigger a push notification via FCM
            console.log(`User ${userId} exceeded budget: ${newSpent}/${userData.budget}`);
        }
    });

// Notification for new invites
exports.onInviteCreated = functions.firestore
    .document('invites/{inviteId}')
    .onCreate(async (snap, context) => {
      const invite = snap.data();
      const toEmail = invite.to;

      // In a real app, you would send an actual email here using:
      // 1. Firebase Extensions (Trigger Email)
      // 2. An email provider like SendGrid or Mailgun
      // 3. Integration code below using 'nodemailer' or the provider's SDK
      
      console.log(`Instructions: Log in to FinBuddy at your-app-url.web.app with email ${toEmail} to accept the invite.`);
      
      return null;
    });

// Accept Invitation: Securely handle group joining
exports.acceptInvitation = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  console.log("Accept Invitation call received:", data);
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { inviteId } = data;
  if (!inviteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing inviteId.');
  }

  const uid = context.auth.uid;
  const email = context.auth.token.email.toLowerCase();

  try {
    const inviteRef = db.collection('invites').doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      console.error(`Invite ${inviteId} not found.`);
      throw new functions.https.HttpsError('not-found', 'Invitation not found or expired.');
    }

    const inviteData = inviteDoc.data();
    console.log("Processing invite:", inviteData);

    if (inviteData.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Invitation is no longer active.');
    }

    if (inviteData.to.toLowerCase() !== email) {
      console.error(`Email mismatch: invite=${inviteData.to}, current=${email}`);
      throw new functions.https.HttpsError('permission-denied', 'This invitation was sent to a different email address.');
    }

    // Perform join in transaction
    await db.runTransaction(async (transaction) => {
      const groupRef = db.collection('groups').doc(inviteData.groupId);
      const userRef = db.collection('users').doc(uid);

      const groupDoc = await transaction.get(groupRef);
      if (!groupDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'The group no longer exists.');
      }

      const userDoc = await transaction.get(userRef);
      if (userDoc.exists && userDoc.data().groupId) {
        // Optional: fail if already in a group, or just allow switch
        console.log(`User ${uid} switching groups or re-joining.`);
      }

      // Update Group
      const members = groupDoc.data().members || [];
      if (!members.some(m => m.userId === uid)) {
        transaction.update(groupRef, {
          members: admin.firestore.FieldValue.arrayUnion({
            userId: uid,
            role: 'member',
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        });
      }

      // Update User
      transaction.update(userRef, {
        groupId: inviteData.groupId,
        groupName: groupDoc.data().name || 'Shared Wallet',
        role: 'member'
      });

      // Close Invite
      transaction.update(inviteRef, {
        status: 'joined',
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`Join successful for ${uid} -> ${inviteData.groupId}`);
    return { success: true };

  } catch (error) {
    console.error('Accept invite crash:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Error joining group');
  }
});

// Validate invitation email
exports.validateInvitationEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
  }

  try {
    // Check if email exists in users collection
    const userSnap = await db.collection('users').where('email', '==', email.toLowerCase()).get();
    
    if (userSnap.empty) {
      throw new functions.https.HttpsError('not-found', 'User not found. They must sign up for FinBuddy first.');
    }

    const userData = userSnap.docs[0].data();
    
    // Check if user is already in a group
    if (userData.groupId) {
      throw new functions.https.HttpsError('failed-precondition', 'User is already in a group.');
    }

    return { valid: true, userId: userSnap.docs[0].id };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Error validating email');
  }
});
