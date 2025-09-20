# 🎯 AI Video Proctoring System

A browser-based proctoring system that simulates **face detection**, **attention monitoring**, and **object detection** for online interviews or exams.  
Built with **plain HTML/CSS/JS** and **TensorFlow.js** for object detection (COCO-SSD).

---

## 🚀 Features

- Candidate webcam feed with overlay boxes.
- Attention monitoring (focused, looking away, no face, multiple faces).
- Object detection (flags suspicious items like phones, books, laptops).
- Live status cards showing face, attention, object and system status.
- Interview setup panel with candidate name, position, auto-generated Session ID.
- Live statistics (duration, focus loss, suspicious items, integrity score).
- Real-time alerts with timestamps.
- Report generation with full event timeline and final score.

---

## 🛠️ Tech Stack

- HTML5 / CSS3 / Vanilla JavaScript  
- TensorFlow.js  
- COCO-SSD Pretrained Model  

---

## 📂 Project Structure
├── index.html # Main UI + JS logic
└── README.md # This file

---

## ⚙️ How It Works

1. **Camera Access**  
   Uses `navigator.mediaDevices.getUserMedia` to stream the webcam feed into a `<video>` element.

2. **Face Detection Simulation**  
   For demo purposes, face detection/attention is simulated with random scenarios every 2 seconds.

3. **Object Detection**  
   Uses TensorFlow.js and COCO-SSD to scan each frame for suspicious items every 3 seconds.

4. **Integrity Score**  
   Starts at 100 and decreases for focus loss events (−10 each) or suspicious objects (−15 each).

5. **Report Generation**  
   When the interview stops, clicking **Generate Report** shows a full event timeline and final score.

---

## 🖥️ Getting Started

### Prerequisites
- Modern browser (Chrome, Edge, Firefox) with camera permissions enabled.
- Internet connection to load TensorFlow.js and COCO-SSD from CDN.

