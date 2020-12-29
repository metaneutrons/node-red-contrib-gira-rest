#/bin/sh
cd ~/.node-red
npm uninstall node-red-contrib-gira-rest
npm install https://github.com/metaneutrons/node-red-contrib-gira-rest.git
rm -f -r ~/.node-red/node_modules/node-red-contrib-gira-rest
ln -s ~/Documents/src/node-red-contrib-gira-rest ~/.node-red/node_modules/node-red-contrib-gira-rest