# pushkin

## What is it?

A link between our site/apps and [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/). It's a service provided by Google that will send push messages to iOS, Android and the web Push API. It also handles things like topic subscriptions, so we don't have to send hundreds of pushes at once outselves, we just let Google handle it.

In normal situation Pushkin isn't necessary, you just add the Firebase dependencies to your site and apps and interface directly. But our setup is a little weird - for instance, we're passing native push tokens into webviews, so the barriers between native and web get a little fuzzy. Plus, we didn't want to add any dependencies to the apps. So Pushkin is our stand-in for local Firebase libraries.

## What it uses

* Node (currently v8.0)
* Postgres (needs a version that supports the JSONB data type)
* TypeScript

## Where it runs

Pushkin runs on staging and production:

* `https://pushkin.stg.newsdev.nytimes.com/`
* `https://pushkin.newsdev.nytimes.com/`

However, we still need to determine how each environment will be set up. There are additional complications with apps, since different versions of it use different push accounts. TBD.

## Using it in a project

(this will be wrapped up into a client library at some point)

### Authorization

Pushkin currently has two levels of authentication - user and admin. Individual actions like getting a token and subscribing to a topic are user level, wheras sending a message is admin level.

You'll need to send a token in the `Authorization` header of any request. If you don't know what the tokens are, you'll be able to find them in Meta.

### Getting a token

Firebase requires a Firebase-generated token for every device you want to interact with. If you're using the Android app, you already have a Firebase token in the webview. But if you're using iOS or the web, you'll need to get one. Do that through this endpoint:

    POST /registrations

#### On the web

Web notifications are secured using a [VAPID key](https://blog.mozilla.org/services/2016/04/04/using-vapid-with-webpush/). Unfortunately, right now FCM [only supports using their own key](https://developers.google.com/instance-id/reference/server#import_push_subscriptions), but the following has been set up so that we can create our own keys when it's possible (so our push tokens are easily exportable should something better than FCM turn up some day). The VAPID key is available at `/vapid-key` and has to be in the form on a `Uint8Array`, so do the following:

    let res = await fetch(`${PUSHKIN_HOST}/vapid-key`, {
        headers: {
            Authorization: USER_KEY
        }
    });
    let keyArray = new Uint8Array(await res.arrayBuffer());

Then you can run [`PushManager.subscribe()`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe) to get the actual subscription object:

    let sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true // you must always set this for now
        applicationServerKey: keyArray
    })

Then you can just send that subscription object to Pushkin:

    let res = await(`${PUSHKIN_HOST}/registrations`)

If you're on the web, the body just needs to be the result of [`PushManager.subscribe()`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
