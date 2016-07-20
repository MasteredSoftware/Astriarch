Astriarch
=========

Astriarch Ruler of the Stars, Space Strategy Game
http://www.astriarch.com/

This is the Open Source Multiplayer version of Astriarch.

It uses NodeJS and MongoDB on the server and leverages WebSockets for communication to the client

Running the Server
==================
You'll need to install Node.js 0.10+ and MongoDB
Run `npm install` then `npm start` and then visit `http://localhost:8000`

Or the easiest way to get started is to use [Docker](https://www.docker.com/):
create a file `./config/local.json`:
```
   {
     "mongodb":{
       "host":"astriarch_mongo"
     }
   }
```
Run `docker-compose build` then `docker-compose up` and then visit `http://localhost:8000`

Overview
========
Astriarch - Ruler of the Stars is a Turn-based, Single Player Space Strategy Game.
Build planetary improvements and star ships to capture planets and defeat your enemies.
Your ultimate goal is to become the master of the known universe, and earn the title of Astriarch!

Background
==========
Developed in 2010 by <a href="http://www.masteredsoftware.com/" target="_blank">Mastered Software</a>, Astriarch combines aspects of other classic space strategy games such as <a href="http://en.wikipedia.org/wiki/Master_of_Orion_II:_Battle_at_Antares" target="_blank" rel="nofollow">Master of Orion 2</a> (MOO2), <a href="http://hol.abime.net/3427" target="_blank" rel="nofollow">Stellar Conflict</a> (1987 Amiga), and <a href="http://en.wikipedia.org/wiki/Star_Control" target="_blank" rel="nofollow">Star Control</a>.
<br /><br />
Currently Astriarch is realeased as a free casual web game.&nbsp; Planned future enhancements include the ability to research and develop improvements, as well as galaxy special items and events.
<br /><br />
The name Astriarch comes from the Ancient Greek words for star (<a href="http://en.wiktionary.org/wiki/%E1%BC%84%CF%83%CF%84%CF%81%CE%BF%CE%BD#Ancient_Greek" target="_blank" rel="nofollow">�stron</a>) and ruler (<a href="http://en.wiktionary.org/wiki/%E1%BC%80%CF%81%CF%87%CF%8C%CF%82" target="_blank" rel="nofollow">arkhos</a>)

Other Versions
==============
Single Player Open Source Versions:

HTML5: https://github.com/mpalmerlee/Astriarch/tree/HTML5

Silverlight: https://github.com/mpalmerlee/Astriarch/tree/Silverlight

Credits
=======
Astriarch - Ruler of the Stars, space strategy game designed and developed by <a href="http://www.masteredsoftware.com/" target="_blank">Mastered Software</a>, music by Resonant. Astriarch HTML 5/JavaScript version uses <a href="https://github.com/mpalmerlee/Stratiscape" target="_blank">Stratiscape</a> JavaScript Canvas Library and the <a href="https://github.com/mpalmerlee/jQuery-UI-Listbox" target="_blank">jQuery Listbox plugin</a>.

License
=======
This version of Astriarch - Ruler of the Stars is released under the MIT License.
