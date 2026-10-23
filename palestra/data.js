const v=(id,name,gear,loadType='weight',note='')=>({id,name,gear,loadType,note});
const ex=(id,name,group,sets,reps,rest,variants,note='')=>({id,name,group,sets,reps,rest,variants,note});
const DEFAULT_ROUTINES={A:{name:'Total Body A',focus:'Spinta, trazione e stabilità',color:'green',exercises:[
ex('a1','Leg press','Gambe',3,'8–10',120,[v('legpress','Leg press','Macchina'),v('goblet','Goblet squat','Manubrio'),v('split','Split squat','Manubri')],'Nelle varianti unilaterali le ripetizioni sono per lato.'),
ex('a2','Nordic curl assistito','Gambe',2,'6–8',120,[v('nordic','Nordic curl assistito','Appoggio sicuro','body'),v('legcurl','Leg curl','Macchina'),v('slider','Leg curl con slider','Slider','body')],'Nordic con assistenza e movimento controllato; riduci l’escursione se necessario.'),
ex('a3','Calf raise a una gamba','Gambe',3,'12–15',60,[v('calf-single','Calf raise a una gamba','Manubrio'),v('calf-stand','Calf raise in piedi','Macchina'),v('calf-press','Calf raise alla pressa','Macchina')],'Ripetizioni per lato nella versione a una gamba.'),
ex('a4','Panca inclinata con manubri','Petto',3,'8–12',90,[v('incline-db','Panca inclinata con manubri','Manubri'),v('incline-machine','Chest press inclinata','Macchina'),v('incline-bb','Panca inclinata con bilanciere','Bilanciere')]),
ex('a5','Trazioni assistite','Dorso',3,'8–10',90,[v('pullup-assisted','Trazioni assistite','Macchina','assistance'),v('lat-wide','Lat machine presa larga','Cavo'),v('lat-neutral','Lat machine presa neutra','Cavo')],'Trazioni: registra i kg di assistenza. Meno assistenza significa più carico.'),
ex('a6','Alzate laterali','Spalle',2,'12–15',60,[v('lateral-machine','Alzate laterali alla macchina','Macchina'),v('lateral-db','Alzate laterali con manubri','Manubri'),v('lateral-cable','Alzate laterali al cavo','Cavo')]),
ex('a7','Pushdown con corda','Tricipiti',2,'10–12',60,[v('pushdown-rope','Pushdown con corda','Cavo'),v('pushdown-bar','Pushdown con barra','Cavo'),v('skullcrusher','Skullcrusher con manubri','Manubri')]),
ex('a8','Dead bug','Core',2,'8–10',45,[v('deadbug','Dead bug','Tappetino','body'),v('birddog','Bird dog','Tappetino','body'),v('heel-tap','Heel tap supino','Tappetino','body')],'Ripetizioni per lato, senza perdere il controllo del bacino.')
]},B:{name:'Total Body B',focus:'Catena posteriore e controllo',color:'orange',exercises:[
ex('b1','Hip thrust','Gambe',3,'8–12',120,[v('hip-machine','Hip thrust alla macchina','Macchina'),v('hip-bb','Hip thrust con bilanciere','Bilanciere'),v('bridge-db','Glute bridge con manubrio','Manubrio')]),
ex('b2','Affondi indietro','Gambe',2,'8–10',90,[v('reverse-lunge','Affondi indietro','Manubri'),v('step-up','Step-up basso','Manubri'),v('split','Split squat','Manubri')],'Ripetizioni per lato. Inizia a corpo libero per trovare il controllo.'),
ex('b3','Calf raise da seduto','Gambe',3,'12–15',60,[v('calf-seated','Calf raise da seduto','Macchina'),v('calf-db-seated','Calf raise seduto con manubri','Manubri'),v('calf-knee','Calf raise a ginocchia flesse','Appoggio','body')]),
ex('b4','Chest press','Petto',3,'8–12',90,[v('chest-machine','Chest press','Macchina'),v('bench-db','Panca piana con manubri','Manubri'),v('pushup','Piegamenti sulle braccia','Tappetino','body')]),
ex('b5','Rematore al cavo','Dorso',3,'8–12',90,[v('row-cable','Rematore al cavo da seduto','Cavo'),v('row-db','Rematore con manubrio','Manubrio'),v('row-machine','Rematore alla macchina','Macchina')],'Nel rematore a un braccio le ripetizioni sono per lato.'),
ex('b6','Lento avanti da seduto','Spalle',2,'8–12',90,[v('shoulder-machine','Lento avanti alla macchina','Macchina'),v('shoulder-db','Shoulder press con manubri','Manubri'),v('landmine','Landmine press a un braccio','Bilanciere')]),
ex('b7','Curl bicipiti','Bicipiti',2,'10–12',60,[v('curl-db','Curl con manubri','Manubri'),v('curl-cable','Curl al cavo','Cavo'),v('curl-hammer','Curl a martello','Manubri')]),
ex('b8','Bird dog','Core',2,'8–10',45,[v('birddog','Bird dog','Tappetino','body'),v('deadbug','Dead bug','Tappetino','body'),v('heel-tap','Heel tap supino','Tappetino','body')],'Ripetizioni per lato, movimento lento e controllato.')
]}};
const PLAN_OPTIONS={easy:'Corsa facile',quality:'Corsa di qualità',long:'Lungo',A:'Total Body A',B:'Total Body B',rest:'Riposo'};
const DEFAULT_PLAN=['easy','A','quality','easy','B','rest','long'];
