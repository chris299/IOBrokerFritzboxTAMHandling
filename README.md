# IOBrokerFritzboxTAMHandling
Script to manage and transcribe AnsweringMachine Message on AVM Fritzbox

## Motivation

often difficult to hear messages, so it makes sense to get a quicker idea of the content by reading the transcript

## Usage
The script to send transcript is separate and triggered by new transcript in iobroker datapoint

## Requirements
Setting up and running TR-064 adapter in IOBroker (and Javascript Adapter of course)
https://github.com/iobroker-community-adapters/ioBroker.tr-064

## Setup Azure Keys for Microsoft Speech service free tier

You need an instance of the speech service. Currently, the free tier is only available in region westeurope, not in region Germany....
https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/SpeechServices 

![grafik](https://github.com/user-attachments/assets/ebe3fd55-9236-42ad-8353-30ddda8faf88)


![grafik](https://github.com/user-attachments/assets/d6714e48-c218-4708-b177-b05946891456)


![grafik](https://github.com/user-attachments/assets/52b479be-0c2e-423d-b68f-a914162497a0)


![grafik](https://github.com/user-attachments/assets/84c357be-1cea-438c-bd23-7fd8e37a9cab)



## ToDo
- Multiple TAMs not supported yet
- Sending of wav files is possible, but not nicely integrated to be used with other scripts (needs patching of script)


### Helpful URLs

documentation of IOBroker Javascript possibilities:
https://github.com/ioBroker/ioBroker.javascript/blob/master/docs/en/javascript.md#httpget
https://forum.iobroker.net/topic/36999/neu-diverse-async-funktionen-im-javascript-adapter

TR64 for Fritz TAM
https://fritz.com/service/schnittstellen/
https://fritz.com/fileadmin/user_upload/Global/Service/Schnittstellen/x_contactSCPD.pdf    
https://fritz.com/fileadmin/user_upload/Global/Service/Schnittstellen/x_tam.pdf

