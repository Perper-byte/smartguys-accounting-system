const electron = require('electron');
console.log('Is electron object?', typeof electron);
console.log('App defined?', typeof electron.app);
if (typeof electron === 'string') {
  console.log('Path:', electron);
}
