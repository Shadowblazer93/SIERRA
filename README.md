# SIERRA: A Visual Graph Query Interface for property graphs

## Running the Project

First, open "C:\Program Files\neo4j-community-4.4.16\conf\neo4j.conf"

- comment on the line "dbms.default_database=neo4j" by adding an #
- uncomment the line "dbms.default_database=northwind" by deleting the #

Then, run powershell as adminstrator and input

```sh
$ neo4j.bat console
```

Next, open another powershell window and input

```sh
$ cd D:\\SystemDemos\\SIERRA\\SIERRA-master
$ npm start
```

The application will start running at http://localhost:3000/.

## Project Structure

```
.
├── config                   # Webpack and Jest configuration
├── public                   # Static public assets (not imported anywhere in source code)
│   └── index.html           # Main HTML page template for app
├── src                      # Application source code
│   ├── assets               # Assets such as images
│   ├── components           # Global Reusable Components
│   ├── App.jsx              # App Component, the main component which acts as a container for all other components.
│   ├── App.css              # Application-wide styles and theme
│   ├── constants.js         # Global Reusable Components
│   ├── neo4jApi.js          # Back-end logic to run queries on underlying property graph
│   ├── Reducer.js           # Reducer to modify global state
│   ├── Store.js             # Global store to keep track of state
|   ├── ...
|   ├── index.jsx            # Application bootstrap and rendering with store
└── static                   # Static public assets imported anywhere in source code
```
