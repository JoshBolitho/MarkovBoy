// author: josh bolitho
// inspired by a similar bot on the Bot Appreciation Society discord 

const fs = require('fs');
const Discord = require('discord.js');
const bot = new Discord.Client();

//loading the discord token -- to safely upload this project to git.
const tokenFile = 'auth.json';
const token = loadToken(tokenFile);

//markov constants & variables
const jsonName = 'Dict1.json';

//the entire trained dataset
var trainingData = loadTrainingData();

//keeps track of how many messages the bot has learned from since the last write to disk
var numMessagesTrained = 0;
//how many messages to train before writing to disk
const maxmessagesTrained = 20;

//recursive attempting generation limit
//max number of times to retry if generateMarkov() fails 
const maxAttempts = 10;
var attempts = 0;

//run once the app has started and ready to recieve messages
bot.on('ready', () => {
   console.log("Markovboy online");
})

//run whenever any message is sent on the discord server.
bot.on('message', message=>{

    //ignore bots
    if(message.author.bot) return;

    //special command for writing pending learned updates to disk.
    if(message.content == "msave"){
        if(writeTrainingDataToDisk()){
            numMessagesTrained = 0;
            console.log('written training data to disk');
        }else{
            console.log('failed writing training data to disk');
        }
        return;
    }

    var msg = message.content;

    //user has asked for a markov sentence
    if(msg.toLowerCase().includes('mark')){
        
        //generateMarkov creates a markov sentence using trained words. 
        var generatedSentence = generateMarkov();

        //report error to discord if generated response is entirely whitespace. 
        if(generatedSentence.replace(/\s/g, "")!=""){
            message.channel.send(generatedSentence);
        }else{
            message.channel.send("beep boop :)");
        }

        //bot will also learn from the user's message once response is sent to user 
        newMsg = msg.replace("mark", " ");
        if(trainMarkov(newMsg)){
            numMessagesTrained++;
        }
    
    }else{
        //only training the bot, no response is sent
        if(trainMarkov(msg)){
            numMessagesTrained++;
        }
    }

    //checks whether enough new messages have been learned from to write the updated training data to disk
    if(numMessagesTrained >= maxmessagesTrained){
        if(writeTrainingDataToDisk()){
            numMessagesTrained = 0;
            console.log('written training data to disk');
        }else{
            console.log('failed writing training data to disk');
        }
    }
})

//trains the bot from a single string.
function trainMarkov(string){
    //support for multiple lined messages
    lines = string.split('\n');
    
    //discard empty lines
    lines = lines.filter((line)=>{return !(line =='\n' || line =='' || line ==null)});

    //split each line of the message by spaces.
    //this gives us an array of arrays of separated words
    var lines = lines.map(function(e) {
        //split line into array of words.
        e = e.split(' ');
        //remove words which are just spaces or gaps
        e = e.filter(f => !f.replace(/\s/g, "") == ""); 
        return e;
    });


    //process each valid line:
    for(l=0;l<lines.length;l++){
        var line = lines[l];
        console.log('training:');
        console.log(lines[l]);
        
        //ignores any empty sentences.
        if(line.length < 1){
            continue;
        }

        //tags that MarkovBoy uses to mark the start and finish of lines
        //i.e. in the format "Start1", "the", "quick", "brown", "fox", "End1"
        line.push('End1');
        line.unshift('Start1');

        //loop the sentence, excluding the last word (which will always be 'End1').
        for(i=0; i < line.length-1 ;i++){
            //findIndex attempts to locate current word's entry in trainingData, if it has one.
            var wordLocation = trainingData.findIndex((element) =>{
                //tests whether a given entry in the trainingData array corresponds 
                //to line[i] (the current word being trained)
                return element[0] == line[i];
            })

            //index was found, current word already exists in trainingData 
            if(wordLocation >= 0){
                //add the next word to the current word's corresponding array
                trainingData[wordLocation][1].push(line[i+1]);
            }else{
                //otherwise, create a new key value pair
                //in the format [ currentword, [nextword] ]
                trainingData.push([line[i],[line[i+1]]]);
            }
        }
        
    }
    return true;
}

//generates a new markov sentence
function generateMarkov(){
    //the bot hasn't been trained yet
    if(trainingData.length==0) return 'Please teach me words first :)';

    console.log("generating...");

    //constructs an array of strings by chaining them together. 
    var sentenceFinished = false;
    var constructedSentence = [];
    //"Start1" prepended before training, so all markov chains begin with Start1.
    //"Start1" is never pushed to constructedSentence. it's just a tag.
    var currentWord = 'Start1';

    while(!sentenceFinished){
        //findIndex attempts to locate current word in trainingData
        //given the linked nature of training markov chains, we expect findIndex to be successful.
        var wordLocation = trainingData.findIndex((element) =>{
            return element[0] == currentWord;
        })
        
        //selects the next word randomly from the current word's array. 
        var nextWord = trainingData[wordLocation][1][
            Math.floor(Math.random()*trainingData[wordLocation][1].length)
        ];

        //add this newly found word to constructedSentence.
        constructedSentence.push(nextWord);
        //update currentWord with our new word.
        currentWord = nextWord;

        //"End1" is the sentence end tag. if it was chosen, the sentence has reached a natural end.
        if(currentWord == 'End1'){
            sentenceFinished = true;
        }
    }
    // remove "End1" from the end of the array
    constructedSentence.pop();

    //concatenates all the strings in the sentence array. 
    var connectedSentence = '';
    for(i in constructedSentence){
        connectedSentence += constructedSentence[i] + ' ';
    }
    //one final test for empty sentence
    if(connectedSentence.replace(/\s/g, "") == ""){
        if(attempts++ == maxAttempts){
            return "beep boop :)";
        }
        return generateMarkov();
    }

    return connectedSentence;
}
//some io functions. 
function loadTrainingData(){
	try{
		let jsonData = require(`./${jsonName}`);
        return jsonData;
        
    }catch(err){throw err;}
}

function writeTrainingDataToDisk(){
	var JsonTrainingData = JSON.stringify(trainingData);
    fs.writeFileSync(jsonName,JsonTrainingData);
    return true;
}

function loadToken(tokenFile){
	try{
		let token = require(`./${tokenFile}`).token;
        return token;
        
    }catch(err){throw err;}
}
//starts the bot.
bot.login(token);