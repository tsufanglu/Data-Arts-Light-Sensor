//@program

/*
  Copyright 2011-2014 Marvell Semiconductor, Inc.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
  version: Data Arts 1.0 UC Regents
*/

Pins = require("pins");
SCROLLER = require("scroller");

var BUCKET_KEY = "HC3TNY9UG5AA";
var ACCESS_KEY = "JPpMpKKjwSnGlv8JIl2gDpBh0hY5XG80";

var INITIALSTATE_API_URI = "https://groker.initialstate.com/api/events"


/* UI */
var normalTextStyle = new Style( { font: "20px", color:"white" } );
var errorTextStyle = new Style( { font: "20px", color:"red" } );

var lineOfText = Label.template($ => ({ 
	left:0, right:0, top:5, height: 25, 
	style: $.style,
	string: "Average: "+$.average+", Min: "+$.min+", Max: "+$.max
}))

var MainContainer = Container.template($ => ({
    left:0, right:0, top:0, bottom:0,
    contents: [
        SCROLLER.VerticalScroller($, { 
            active:true, top:25, bottom:0,
            contents: [
                $.contentToScroll
            ]                     
        }),
    ]
}));

var contentToScroll = new Column({ 
	top:0, left:0, right:0, 
	contents: [
		new Label({ left:0, right:0, height:30, style: normalTextStyle, string: "Messages sent:" }) 
	]
})
var mainCon = new MainContainer({ contentToScroll });


/* APPLICATION SET-UP */
class AppBehavior extends Behavior{
	onLaunch(application) {
		application.add(mainCon);
		
		if ("YOUR BUCKET ID" == BUCKET_KEY || "YOUR ACCESS KEY" == ACCESS_KEY) {
			let errorStyle = new Style( { font: "24px", color: "white", horizontal: "middle", vertical:"center" } );
			application.add( new Text( { string: "This application requires an Initial State account. You can sign up for a free account at initialstate.com", left: 0, right: 0, style: errorStyle } ) );
		} else {
			//setting the pins here
			Pins.configure({
				ground: {pin: 51, type: "Ground", },
				power: {pin: 52, voltage: 5.0, type: "Power"},
		        sensor: {pin: 53, type: "Analog"}
		    }, success => {
		    	var index = 0;
		    	var total = 0;
		    	var min, max;
		    	// 1000 is the time in miliseconds between each observation. 1000 means one observation every second
		    	Pins.repeat("/sensor/read", 1000, function(analogValue) {
		    		if (index == 0) {
		    		//store first reading in the set to be averaged
		    			min = max = analogValue;
		    		} else {
		    		//store min or max value
			    		if (analogValue < min){
			    			min = analogValue;
			    		} else if (analogValue > max) {
			    			max = analogValue;
			    		}
		    		}
		    		//summation of observations to be averaged
		    		total += analogValue;
		    		//increase of index by 1, until we reach threshold
		    		index++;
		    		// 60 is number of observations to average; this will send the average of every 60 observations to initial state. This means one observation per minute. 
		    		if (index == 60) {
		    			trace("average is: "+total/index+"\n");
		    			trace("min is: "+min+"\n");
		    			trace("max is: "+max+"\n");
						application.delegate("onSensorValue", total/index, min, max); //sends the average, min, and max value of obervations
						index = 0;
						total = 0;
						min = max = null;
					}
				});
			});
		}
	}
	onSensorValue(app, analogValue, min, max){
		// send data to the cloud
		let message = new Message(INITIALSTATE_API_URI);
		message.method = "POST";
		message.setRequestHeader("Content-Type", "application/json");
		message.setRequestHeader("X-IS-AccessKey", ACCESS_KEY);
		message.setRequestHeader("X-IS-BucketKey", BUCKET_KEY);
		message.setRequestHeader("User-Agent", "Kinoma");
		
		let body = [
			{ key: "analogValue", value: analogValue}, 
			{ key: "min", value: min}, 
			{ key: "max", value: max}, 
		];
		
		message.requestText = JSON.stringify( body ); 
		
		message.setRequestHeader("Content-Length", message.requestText.length);
		message.invoke( Message.TEXT ).then(text => {
			let roundTo = 5; //number of decimal places to round to (to save space on screen of Kinoma Create)
			if (message.status != 204){
				trace("Initial State stream did not update successfully. Server replied with: " + text + "\n");
				contentToScroll.add(new lineOfText({ style: errorTextStyle, average: analogValue.toFixed(roundTo), min: min.toFixed(roundTo), max: max.toFixed(roundTo) }));
			} else {
				contentToScroll.add(new lineOfText({ style: normalTextStyle, average: analogValue.toFixed(roundTo), min: min.toFixed(roundTo), max: max.toFixed(roundTo) }));
			}		
		}); 
	}
}

application.behavior = new AppBehavior();

