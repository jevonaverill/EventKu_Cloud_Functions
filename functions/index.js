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
const request = require('request-promise');

const gcs = require('@google-cloud/storage')()
const spawn = require('child-process-promise').spawn

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

// Cloud Storage Triggers
exports.generateThumbnail = functions.storage.object().onChange(event => {
  const object = event.data
  const filePath = object.name
  const fileName = filePath.split('/').pop()
  const fileBucket = object.bucket
  const bucket = gcs.bucket(fileBucket)
  const tempFilePath = `/tmp/${fileName}`

  if (fileName.startsWith('thumb_')) {
    console.log("Already a thumbnail")
    return
  }

  // if (!object.contentType.startsWith('/image/')) {
  // console.log('This is not an image')
  // return
  // }

  // if (object.resourceState === 'not_exists') {
  //   console.log("This is a deletion event");
  //   return
  // }

  return bucket.file(filePath).download({
    destination: tempFilePath
  }).then(() => {
    return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath])
  }).then(() => {
    const thumbFilePath = filePath.replace(/(\/)?([^\/]*)$/, '$1thumb_$2')

    return bucket.upload(tempFilePath, {
      destination: thumbFilePath
    })
  })
})

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

// [START sendEmailEventVerified]
/**
 * Sends an email to event that have been verified.
 */
// [START onCreateTrigger]
exports.sendEmailEventVerified = functions.database.ref('/events/{eventId}')
  .onCreate(event => {
    // [END onCreateTrigger]
    // [START eventAttributes]
    console.log("id oii");
    console.log(event.params.eventId);
    const eventSnapshot = event.data; // The Firebase user.
    // Exit when the data is deleted.
    return sendEmailEventVerifiedTest(eventSnapshot)
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

function sendEmailEventVerifiedTest(event) {
  const mailOptions = {
    from: `${APP_NAME} <noreply@eventku.com>`,
    to: 'jevonave@gmail.com'
  };

  console.log(event);
  console.log(mailOptions);

  const eventName = event.child('eventName').val();

  // The user subscribed to the newsletter.
  mailOptions.subject = `${APP_NAME} - Verified`;
  mailOptions.html = `Your event: ${eventName} has been verified.<br/><br/>
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

// Shorten URL
exports.shortenUrl = functions.database.ref('/events/{eventId}').onCreate(event => {
  console.log('1')
  console.log(event);
  return createShortenerPromise(event);
});

// URL to the Google URL Shortener API.
// AIzaSyDbGrJ04pL8w8Cr9Vb2CZnQ_uTAg0yIffM
function createShortenerRequest(sourceUrl) {
  console.log('4')
  return {
    method: 'POST',
    uri: `https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyDbGrJ04pL8w8Cr9Vb2CZnQ_uTAg0yIffM`,
    body: {
      longUrl: sourceUrl
    },
    json: true,
    resolveWithFullResponse: true
  };
}

function createShortenerPromise(snapshot) {
  console.log('5')
  const originalUrl = snapshot.data.child("backgroundImageURL").val();
  const eventId = snapshot.params.eventId;
  console.log('snap')
  console.log(snapshot)
  console.log(eventId)
  return request(createShortenerRequest(originalUrl)).then(response => {
    console.log('6')
    if (response.statusCode === 200) {
      console.log('7')
      return response.body.id;
    }
    throw response.body;
  }).then(shortUrl => {
    console.log('8')
    return admin.database().ref(`/events/${eventId}`).set({
      eventName: snapshot.data.child("eventName").val(),
      eventDescription: snapshot.data.child("eventDescription").val(),
      eventCategory: snapshot.data.child("eventName").val(),
      eventLocation: snapshot.data.child("eventCategory").val(),
      eventDate: new Date(snapshot.data.child("eventDate").val()).toISOString(),
      isVerified: false,
      backgroundImageURL: shortUrl
    });
  });
}