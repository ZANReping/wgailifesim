import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Import CSS if it exists locally, or rely on index.html styles. 
// Assuming index.css might contain Tailwind directives or other globals.
// import './index.css'; 

console.log("App starting...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("App mounted successfully.");
} catch (error) {
    console.error("App failed to mount:", error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;"><h1>启动错误</h1><p>${error}</p></div>`;
}
