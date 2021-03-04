import { Vague } from './../models/Vague';
import { Commande } from './../models/Commande';
import { SseService } from './../services/sse.service';
import { Component, OnInit } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import Speech from 'speak-tts';
import {  ChangeDetectorRef } from '@angular/core';
import { ELocalNotificationTriggerUnit, LocalNotifications } from '@ionic-native/local-notifications/ngx';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  orders = [];
  vagues = [];
  tmp: Observable<any>;
  speech = new Speech();
  mic: any;
  micToggle =  false;
  rushHour = false;
  vagueDictionary = {};
  idVague = 0;
  textPerVague = {};
  MAX_VAGUES_ORDERS = 5;
  rushMode = false;

  constructor(private http: HttpClient, private sseService: SseService, private cdr: ChangeDetectorRef,
              private localNotification: LocalNotifications, private plt: Platform) {
    // let source = new EventSource('http://localhost:9428/api/repas/sse');
    // source.addEventListener('message', aString => console.log(aString.data), false);
   /*this.tmp = this.http.get<Repas[]>('http://localhost:9428/api/repas');
    this.tmp.subscribe( data => {
      console.log(data);
    });*/
      const {webkitSpeechRecognition} = (window as any);
      this.mic = new webkitSpeechRecognition();
      this.mic.continuous = true;
      this.mic.interimResults = true;
      this.mic.lang = 'fr-FR';
  }

  ngOnInit(){
      if (this.speech.hasBrowserSupport()) { // returns a boolean
          console.log('speech synthesis supported');
      }
      this.speech.init().then((data) => {
          // The "data" object contains the list of available voices and the voice synthesis params
          /*console.log(data.voices[8].lang);
              this.speech.setLanguage(data.voices[8].lang);
              this.speech.setVoice(data.voices[8].name);*/
          console.log('Speech is ready, voices are available', data);
      }).catch(e => {
          console.error('An error occured while initializing : ', e);
      });
/*       this.http.get<any[]>('http://localhost:9428/api/order').subscribe( v => {
      this.orders = v ;
    }); */
      this.sseService
        .getServerSentEvent('http://localhost.180:9428/api/order/stream')
        .subscribe(data => {
          console.log(data);
          const order = JSON.parse(data.data);
          this.orders.push(order.order);
          this.orderToVague(order.order);
          this.isRushHour();
          this.addOrderToDictionary(order.order);
          console.log(this.vagues);
        });


      this.sseService
        .getServerSentEvent('http://localhost:9428/api/preparator/stream')
        .subscribe(data => {
          console.log(data);
          if (data.data === 'rush') {
            console.log('RUSH');
            this.rushMode = true;
          }else {
            console.log(JSON.parse(data.data));
            console.log('Vague terminée par ' + JSON.parse(data.data).name_preparator);
            this.scheduleNotification('Vague terminée par ' + JSON.parse(data.data).name_preparator);
          }

        });
  }

  scheduleNotification(message: string) {
    this.localNotification.schedule({
      id: 1,
      title: 'Etat de votre commande',
      text: message,
      data: {page: 'myPage'},
      trigger: {in: 5, unit: ELocalNotificationTriggerUnit.SECOND}
    });
  }

  async textToSpeech(){
      let order = this.orders[0];

      this.micToggle = !this.micToggle;
      if (!this.micToggle){
          this.mic.stop();
          this.mic.onend = () => {
              console.log('Stopped Mic on Click');
          };
      }else {
          this.mic.start();
          this.mic.onstart = () => {
              console.log('Mics on');
          };

          this.mic.onresult = (event) => {
              /*const transcript = Array.from(event.results)
                  .map(result => result[0])
                  .map(result => result.transcript)
                  .join('');

               */
              if (this.micToggle){
                  const array = Array.from(event.results);
                  const transcript = array[array.length - 1][0].transcript.replace(' ', '');
                  console.log(transcript);
                  switch (transcript){

                      case 'repas':
                          const text = 'entrée : ' + order.repas.entree + '.'
                              + 'plat : ' + order.repas.plat + '.'
                              + 'dessert : ' + order.repas.dessert + '.'
                              + 'boisson : ' + order.repas.boisson + '.';
                          this.speak(text);
                          break;

                      case 'entrée':
                          console.log(order.repas);
                          this.speak(order.repas.entree);
                          break;

                      case 'plat':
                          this.speak(order.repas.plat);
                          break;

                      case 'dessert':
                          this.speak(order.repas.dessert);
                          break;

                      case 'boisson':
                          this.speak(order.repas.boisson);
                          break;

                      case 'suivant':
                          this.ready(order);
                          order = this.orders[0];
                          const text2 = 'entrée : ' + order.repas.entree + '.'
                              + 'plat : ' + order.repas.plat + '.'
                              + 'dessert : ' + order.repas.dessert + '.'
                              + 'boisson : ' + order.repas.boisson + '.';
                          this.speak(text2);
                          break;

                      case 'stop':
                          this.micToggle = !this.micToggle;
                          break;
                      default: {
                          // this.speak('Je n\'ai pas compris');
                          // console.log('default');
                      }
                  }
              }

          };
      }

  }


 speak(textToSpeak: string){
      this.micToggle = !this.micToggle;
      console.log('speaaaaak: ' + textToSpeak);
      /*this.speech.speak({
          text: textToSpeak,
      }).then(() => {
          console.log('Success !');
      }).catch(e => {
          console.error('An error occurred :', e);
      });*/
      this.speech.speak({
         text: textToSpeak,
         listeners: {
             onstart: () => {
                // console.log("Start utterance")
             },
             onend: () => {
                 // console.log("End utterance");
                 this.micToggle = !this.micToggle;
             },
             onresume: () => {
                 // console.log("Resume utterance")
             },
             onboundary: (event) => {
                 // console.log(event.name + ' boundary reached after ' + event.elapsedTime + ' milliseconds.')
             }
         }
     });
  }

  ready(order: Commande){
      console.log(order);
      const index = this.orders.indexOf(order);
      this.orders.splice(index, 1);
      this.cdr.detectChanges();

      this.http.post<any[]>('http://localhost.180:9428/api/user', order).subscribe( v => {
          console.log(v);
        // this.orders = v ;
      });
  }

  readyVague(vague) {
    console.log(vague);
    const index = this.vagues.indexOf(vague);
    this.vagues.splice(index, 1);
    this.cdr.detectChanges();

    vague.orders.forEach(order => {
        this.http.post<any[]>('http://localhost:9428/api/user/vague', order).subscribe( v => {
          console.log(v);
        });
      });

    this.http.post<any[]>('http://localhost:9428/api/preparator/vague', {id: 3, name: 'Kevin'}).subscribe( v => {
        console.log(v);
      });
  }

  isRushHour(): void {
    if (this.orders.length > this.MAX_VAGUES_ORDERS) {
      this.rushHour = true;
      console.log('rushHour should be true');
      console.log(this.rushHour);
    }
    else{
      this.rushHour = false;
      console.log('rushHour should be false');
      console.log(this.rushHour);
    }
}

getEntreesPerVague(vague): string {
    let result = '';
    console.log(this.vagueDictionary);
    for (const key in this.vagueDictionary[vague.id]) {
      const value = this.vagueDictionary[vague.id][key];
      result += value + 'x ' + key + '\n';
    }
    this.textPerVague[vague.id] = result;
    return result;
  }

addOrderToDictionary(newOrder) {
    const currentVague = this.vagues[this.vagues.length - 1];
    console.log(currentVague);
    currentVague.orders.forEach(order => {
      console.log(order === newOrder);
      if (order === newOrder) {
        if (this.vagueDictionary[currentVague.id] === undefined) {
          this.vagueDictionary[currentVague.id] = {};
        }
        if (this.vagueDictionary[currentVague.id][order.repas.entree + ''] === undefined) {
          this.vagueDictionary[currentVague.id][order.repas.entree + ''] = 1;
        }
        else {
          this.vagueDictionary[currentVague.id][order.repas.entree + ''] += 1;
        }
      }
    });

    console.log(this.vagueDictionary);
  }

  orderToVague(order) {
    console.log(order);
    if (this.vagues.length === 0) {
      const vague: Vague = new Vague;
      vague.id = this.idVague;
      vague.orders = [];
      vague.orders.push(order);
      this.vagues.push(vague);
      console.log(this.vagues);
    }
    else if (this.vagues[this.vagues.length - 1].orders.length === this.MAX_VAGUES_ORDERS) {
      this.idVague += 1;
      const vague: Vague = new Vague;
      vague.id = this.idVague;
      vague.orders = [];
      vague.orders.push(order);
      this.vagues.push(vague);
    }
    else {
      this.vagues[this.vagues.length - 1].orders.push(order);
    }
    console.log(this.vagues.length);
    console.log(this.vagues[this.vagues.length - 1]);
  }

}
