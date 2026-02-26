---
title: "Client-side, asynchronous HTTP methods- TypeScript"
date: "2020-10-28"
description: "Example in action! Client source! | Server source! Despite the ubiquitousness of needing to make a POST request from a browser (or, perhaps for this very..."
tags: ["Featured", "Ideas"]
published: true
slug: "asynchronous-http-methods-from-typescript"
original_url: "https://transscendsurvival.org/2020/10/28/asynchronous-http-methods-from-typescript/"
feature_image: "/images/posts/IMG_2967-Edit.jpg"
category: "software"
---

* [**_Example in action!_**](https://tmpui.herokuapp.com/crop_post)
  * [_Client source!_](https://github.com/Jesssullivan/tmpUI/blob/master/demos/spec_record_crop_post.ts#L40) | [_Server source!_](https://github.com/Jesssullivan/tmpUI/blob/master/app.py#L35)

Despite the ubiquitousness of needing to make a POST request from a browser (or, perhaps for this very reason) there seems to be just as many [ways](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest), [methods](https://www.w3schools.com/js/js_ajax_http_send.asp), [libraries](https://www.npmjs.com/package/axios), and [standards](https://developer.mozilla.org/en-US/docs/Web/API/Request) of implementing http functions in JavaScript as there are people doing said implementing. Between the adoption of the [fetch api](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) in browsers and the prevalence and power of [Promises in JS](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), asynchronous http needn't be a hassle!

```typescript
/*
...happily processing some data in a browser, when suddenly...
....panik!
you need to complete a portion of this processing elsewhere on some server...:
*/

const handleBlobPOST = (blob: Blob, destination: string) => {
    /*

   `blob` is some data you've been processing available in the DOM
    (such as a photo or audio) .

    some blob objects to upload:
    */
    const file = blob;

    // file is wrapped in `formData` for POST:
    const formData = new FormData();

    /*
     `name: 'file'` is the ID the server will use to find and parse
     the POSTs contents of fileName: 'fluffy.chonk':
    */
    formData.append('file', file, 'fluffy.chonk');

    // make the POST w/ fetch, no one should be using IE anyway xD:
    fetch(destination, {
    method: 'POST',
    body: formData
  }) // make, then handle the Promise:
    .then(response => {
      /*
      we can .then wait for the Promise Object `response`...
      */
        response.json().then(data => {
             /*
             ...and .then once we have the the `response` Object,
              take only the  important json part:
             */
            console.log('received JSON!');

            /*
            but wait- json is unstructured, how can we continue
            working with this data?
            zing the response json (here just as key: value pairs)
             into an Array:
            */
            let ix;
            let results = [];
            for (ix in data) {
                results.push([ix, data[ix]]);
            }

            /*
            sort the Array by descending value:
            while the json returned is to remain unstructured,
            with this Array we can preform all sorts of nifty operations,
            like so:
            (key: value pairs in this case are string: number,
              so sort pairs by decending value)
            */
            results = results.sort((a, b) =>  b[1] - a[1]);

            // print the sorted scores:
            let i;
            for (i in results) {
                console.log(i + ' ' + results[i]);
            }
        });
    })
    .catch(error => {
        console.error(error);
    });
};

/*
Now that we've got everything sorted by Promise,
we can use this as an async function:
*/
async function postClassifyWaveform() {
    // posts blob directly:
    return handleBlobPOST(someBlobs, '/cool_endpoint');
}
```

_Some extra notes spawned from web demos with Merlin AI:_

  * [...check out more notes on this project here](https://jesssullivan.github.io/tmpUI/)
  * [...and the repo over here](https://github.com/Jesssullivan/tmpUI)

-Jess
