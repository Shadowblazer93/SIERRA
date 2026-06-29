# SIERRA: A Visual Graph Query Interface for property graphs

Try SIERRA : https://Shadowblazer93.github.io/SIERRA

SIERRA Demo Video : https://youtu.be/oqaR1wn9LQk

## Running the Project

Make sure Node v16 is installed on your system

```sh
$ npm run start
```

The application will start running at http://localhost:3000/.

## Running with Docker

Build the Docker image:

```sh
$ docker build -t sierra -f dockerfile .
```

Run the container:

```sh
$ docker run -p 3000:3000 sierra
```

The application will be available at http://localhost:3000/.

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
