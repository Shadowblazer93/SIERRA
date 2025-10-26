import React from 'react';
import ReactDOM from 'react-dom';
import Store from './Store';
// import { BrowserRouter } from 'react-router-dom';
import './App.css';
import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import 'antd/dist/antd.css';

import * as serviceWorker from 'app/service-worker';
import App from './App';

ReactDOM.render(
  <Store>
    <App />
  </Store>,
  document.getElementById('app'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.unregister();
serviceWorker.register();
