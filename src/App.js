import "./App.css";
import firebase from "firebase/compat/app";
import VideoSection from "./VideoSection";

function App() {
  //#region Firebase Setup
  const firebaseConfig = {
    apiKey: "AIzaSyCn_oUCgU-s21Nxe1OuOSrDDhsxROIkewc",
    authDomain: "webrtcdemo-d01e1.firebaseapp.com",
    projectId: "webrtcdemo-d01e1",
    storageBucket: "webrtcdemo-d01e1.appspot.com",
    messagingSenderId: "327532271316",
    appId: "1:327532271316:web:cca5d6b076578764f94d41",
    measurementId: "G-K3SR1DN4Z1",
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  //#endregion

  return (
    <div className="App">
      <VideoSection />
    </div>
  );
}

export default App;
