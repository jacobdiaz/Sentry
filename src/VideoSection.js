import React, { Component } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import * as faceapi from "face-api.js";

export default class VideoSection extends Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = {
      input: "",
      canvas: [],
    };
  }

  createCanvas() {
    console.log("Create Canvas");
    this.setState({
      canvas: <canvas id="canvas" width="640" height="480" ref={this.canvasRef}></canvas>,
    });
  }
  componentDidMount() {
    this.createCanvas();
  }

  updateInputValue(evt) {
    this.setState({
      input: evt.target.value,
    });
  }

  render() {
    const firestore = firebase.firestore();
    // GLOBALS -> these are globals that should be used in multiple components in realit y we should use something like redux to handle these globals
    // Stun Servers
    const servers = {
      iceServers: [
        {
          urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
        },
      ],
      iceCandidatePoolSize: 10,
    };

    // Creata a new peer connection
    const pc = new RTCPeerConnection(servers);

    let localStream = null;
    let remoteStream = null;

    Promise.all([
      // Facial Recognition
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      faceapi.nets.ageGenderNet.loadFromUri("/models"),
    ]).then(console.log("Loaded faceapi"));

    // Starting the local webcam
    let handleWebcamButton = async () => {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }, (err) => {
        console.log(err);
      });
      remoteStream = new MediaStream();

      // Push tracks from local stream to peer connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Pull tracks from remote stream, add to video stream
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      };

      //set webcamVideo src on html to localStream
      this.webcamSrc.srcObject = localStream;
      this.remoteSrc.srcObject = remoteStream;

      // todo change weidth height to be dynamic
      const displaySize = { width: 640, height: 480 };
      //   faceapi.matchDimensions(this.state.canvas, displaySize);

      setInterval(async () => {
        const detections = await faceapi
          .detectAllFaces(this.webcamSrc, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()
          .withAgeAndGender();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        this.canvasRef.current.getContext("2d").clearRect(0, 0, 640, 480);
        faceapi.draw.drawDetections(this.canvasRef.current, resizedDetections);
        faceapi.draw.drawFaceLandmarks(this.canvasRef.current, resizedDetections);
        faceapi.draw.drawFaceExpressions(this.canvasRef.current, resizedDetections);
        resizedDetections.forEach((detection) => {
          const box = detection.detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, { label: Math.round(detection.age) + " year old " + detection.gender });
          drawBox.draw(this.canvasRef.current);
        });

        detections.length !== 0 ? console.log(detections) : console.log("No face detected");
      }, 150);
    };

    // Create a new offer
    let handleCallButton = async () => {
      const callDoc = firestore.collection("calls").doc();
      const offerCandidates = callDoc.collection("offerCandidates");
      const answerCandidates = callDoc.collection("answerCandidates");

      this.setState({
        input: callDoc.id, // Generate some call id and store it in input
      });

      // Get candidate for the caller
      pc.onicecandidate = (event) => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
      };
      //create an offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDoc.set({ offer });

      // Listen for answer from the user
      callDoc.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
      });

      // When answered add candidate to the peer connection

      answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });
    };

    let handleAnswerButton = async () => {
      const callId = this.state.input;
      const callDoc = firestore.collection("calls").doc(callId);
      const answerCandidates = callDoc.collection("answerCandidates");
      const offerCandidates = callDoc.collection("offerCandidates");

      pc.onicecandidate = (event) => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
      };

      // Fetch data, then set the offer & answer

      const callData = (await callDoc.get()).data();

      const offerDescription = callData.offer;
      await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await callDoc.update({ answer });

      // Listen to offer candidates

      offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          console.log(change.doc.data());
          if (change.type === "added") {
            let data = change.doc.data();
            pc.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    };

    return (
      <div>
        <h1>Video Section</h1>
        <h1>Web RTC Demo</h1>
        <span>
          <h3>Local</h3>
          {this.state.canvas}
          <video
            width="640"
            height="480"
            ref={(webcamSrc) => {
              this.webcamSrc = webcamSrc;
            }}
            autoPlay
            playsInline
          ></video>
        </span>
        <span>
          <h3>Remote</h3>

          <video
            ref={(remoteSrc) => {
              this.remoteSrc = remoteSrc;
            }}
            autoPlay
            playsInline
          ></video>
        </span>

        <button onClick={handleWebcamButton}>Start webcam</button>
        <h2>Create new call</h2>
        <button onClick={handleCallButton}>Create Call (offer)</button>
        <h2>Join a Call</h2>
        <input value={this.state.input} onChange={(evt) => this.updateInputValue(evt)}></input>
        <button onClick={handleAnswerButton}>Answer</button>
        <button>Hangup</button>
      </div>
    );
  }
}
