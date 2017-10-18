// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
'use strict';

const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// the required modules for our project have been imported and initialized
admin.initializeApp(functions.config().firebase);

const ref = admin.database().ref();

// Configure the email transport using the default SMTP transport and a GMail account.
// For Gmail, enable these:
// 1. https://www.google.com/settings/security/lesssecureapps
// 2. https://accounts.google.com/DisplayUnlockCaptcha
// For other types of transports such as Sendgrid see https://nodemailer.com/transports/
// TODO: Configure the `gmail.email` and `gmail.password` Google Cloud environment variables.
const gmailEmail = encodeURIComponent(functions.config().gmail.email);
const gmailPassword = encodeURIComponent(functions.config().gmail.password);
const mailTransport = nodemailer.createTransport(
  `smtps://${gmailEmail}:${gmailPassword}@smtp.gmail.com`);

// Your company name to include in the emails
// TODO: Change this to your app or company name to customize the email sent.
const APP_NAME = 'EventKu';

// Push Notification User
exports.pushNotificationUser = functions.database.ref('/users/{userId}')
  .onCreate(event => {
    // Grab the current value of what was written to the Realtime Database.
    const eventSnapshot = event.data;

    // provided topic
    const topic = "user";

    const username = (eventSnapshot.child("displayName").exists()) ? eventSnapshot.child("displayName").val() :
      eventSnapshot.child("fullName").val();

    const payload = {
      data: {
        email: eventSnapshot.child("email").val(),
        name: username
      }
    };

    // Send a message to devices subscribed to the provided topic.
    return admin.messaging().sendToTopic(topic, payload)
      .then(function (response) {
        // See the MessagingTopicResponse reference documentation for the
        // contents of response.
        console.log("Successfully sent message:", response);
      })
      .catch(function (error) {
        console.log("Error sending message:", error);
      });
  });

// Push Notification Event
exports.pushNotificationEvent = functions.database.ref('/events/{eventId}')
  .onCreate(event => {
    // Grab the current value of what was written to the Realtime Database.
    const eventSnapshot = event.data;

    // provided topic
    const topic = "event";

    const payload = {
      data: {
        name: eventSnapshot.child("eventName").val(),
        category: eventSnapshot.child("eventCategory").val(),
        date: new Date(eventSnapshot.child("eventDate").val()).toISOString(),
        location: eventSnapshot.child("eventLocation").val()
      }
    };

    console.log("date: " + payload.data.date);

    // Send a message to devices subscribed to the provided topic.
    return admin.messaging().sendToTopic(topic, payload)
      .then(function (response) {
        // See the MessagingTopicResponse reference documentation for the
        // contents of response.
        console.log("Successfully sent message:", response);
      })
      .catch(function (error) {
        console.log("Error sending message:", error);
      });
  });

// [START sendWelcomeEmail]
/**
 * Sends a welcome email to new user.
 */
// [START onCreateTrigger]
exports.sendEmail = functions.database.ref('/users/{userId}')
  .onCreate(event => {
    // [END onCreateTrigger]
    // [START eventAttributes]
    const eventSnapshot = event.data; // The Firebase user.
    // Exit when the data is deleted.

    const username = (eventSnapshot.child("displayName").exists()) ? eventSnapshot.child("displayName").val() :
      eventSnapshot.child("fullName").val();

    const displayName = username; // The display name of the user.
    const email = eventSnapshot.child("email").val();
    // [END eventAttributes]

    if (!eventSnapshot.exists()) {
      return sendGoodbyeEmail()
    }
    return sendWelcomeEmail(email, displayName);
  });
// [END sendWelcomeEmail]

// // [START sendByeEmail]
// /**
//  * Send an account deleted email confirmation to users who delete their accounts.
//  */
// // [START onDeleteTrigger]
// exports.sendByeEmail = functions.database.ref('/users/{userId}')
//   .onDelete(event => {
// // [END onDeleteTrigger]
//     const eventSnapshot = event.data; // The Firebase user.
//
//     const username = (eventSnapshot.child("displayName").exists()) ? eventSnapshot.child("displayName").val() :
//       eventSnapshot.child("fullName").val();
//
//     const displayName = username; // The display name of the user.
//     const email = eventSnapshot.child("email").val();
//     // [END eventAttributes]
//
//     return sendGoodbyeEmail(email, displayName);
//   });
// // [END sendByeEmail]

// Sends a welcome email to the given user.
function sendWelcomeEmail(email, displayName) {
  const mailOptions = {
    from: `${APP_NAME} <noreply@eventku.com>`,
    to: email
  };

  // The user subscribed to the newsletter.
  mailOptions.subject = `Welcome to ${APP_NAME}`;
  // mailOptions.text = `Hey, ${displayName || ''}! Welcome to ${APP_NAME}. We hope you will enjoy our application.`;
  mailOptions.html = `Hey <b>${displayName || ''}</b>,<br/><br/>
  Welcome to ${APP_NAME}! We want to reach out to make sure you have everything you neet to get started.<br/><br/>
  We hope you will enjoy our application. If you have any questions related with our application, drop us a line any time!<br/><br/>
  Thanks!<br/>
  EventKu Support Team<br/><br/>
  Google Firebase Appfest Hackathon Indonesia. Ayana Midplaza, Jakarta, Indonesia`;
  return mailTransport.sendMail(mailOptions).then(() => {
    console.log('New welcome email sent to:', email);
  });
}

// Sends a goodbye email to the given user.
function sendGoodbyeEmail(email, displayName) {
  const mailOptions = {
    from: `${APP_NAME} <noreply@eventku.com>`,
    to: email
  };

  // The user unsubscribed to the newsletter.
  mailOptions.subject = `Good bye!`;
  // mailOptions.text = `Hey, ${displayName || ''}! We confirm that we have deleted your ${APP_NAME} account.`;
  mailOptions.html = `Hey <b>${displayName || ''}</b>,<br/><br/>
  We confirm that we have deleted your ${APP_NAME} account due to bad behavior.
  Thanks!<br/>
  EventKu Support Team<br/><br/>
  Google Firebase Appfest Hackathon Indonesia. Ayana Midplaza, Jakarta, Indonesia`;
  return mailTransport.sendMail(mailOptions).then(() => {
    console.log('Account deletion confirmation email sent to:', email);
  });
}

// create new user, save to real-time database (logged in via Google Sign-In)
exports.createNewUser = functions.auth.user().onCreate(event => {
  return ref.child(`/users/${event.data.uid}`).set({
    displayName: event.data.displayName,
    email: event.data.email,
    photoURL: event.data.photoURL
  })
});