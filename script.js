/**
 * AI Video Proctoring System
 * Complete implementation with real AI detection
 */

 class VideoProctoringSystem {
    constructor() {
        // Core elements
        this.video = document.getElementById('videoElement');
        this.canvas = document.getElementById('detectionCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // UI elements
        this.loadingScreen = document.getElementById('loadingScreen');
        this.mainApp = document.getElementById('mainApp');
        this.loadingStatus = document.getElementById('loadingStatus');
        this.progressFill = document.getElementById('progressFill');
        
        // Control elements
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.screenshotBtn = document.getElementById('screenshotBtn');
        this.reportBtn = document.getElementById('reportBtn');
        
        // Status elements
        this.systemStatus = document.getElementById('systemStatus');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.faceCount = document.getElementById('faceCount');
        this.statusText = document.getElementById('statusText');
        this.objectCount = document.getElementById('objectCount');
        
        // State management
        this.isInitialized = false;
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.sessionId = this.generateSessionId();
        
        // AI Models
        this.objectDetectionModel = null;
        this.modelsLoaded = false;
        
        // Detection intervals
        this.detectionIntervals = {
            face: null,
            object: null,
            attention: null,
            stats: null
        };
        
        // Statistics
        this.stats = {
            duration: 0,
            focusLossEvents: 0,
            suspiciousItems: 0,
            multipleFaceEvents: 0,
            noFaceEvents: 0,
            integrityScore: 100,
            screenshots: [],
            detectionHistory: []
        };
        
        // Detection state
        this.currentState = {
            faces: 0,
            isAttentive: true,
            lastFaceTime: Date.now(),
            lastAttentionTime: Date.now(),
            consecutiveNoFace: 0,
            consecutiveLookingAway: 0,
            detectedObjects: []
        };
        
        // Configuration
        this.config = {
            faceDetectionInterval: 500,     // 500ms
            objectDetectionInterval: 2000,  // 2 seconds
            attentionCheckInterval: 1000,   // 1 second
            focusLossThreshold: 5000,       // 5 seconds
            noFaceThreshold: 10000,         // 10 seconds
            confidenceThreshold: 0.6        // 60% confidence
        };
        
        // Event log
        this.eventLog = [];
        this.suspiciousObjects = ['cell phone', 'book', 'laptop', 'person', 'cup'];
        
        // Initialize system
        this.init();
    }
    
    // Initialize the system
    async init() {
        try {
            this.updateLoadingProgress(10, 'Setting up camera...');
            await this.setupCamera();
            
            this.updateLoadingProgress(30, 'Loading Face Detection models...');
            await this.loadFaceDetectionModels();
            
            this.updateLoadingProgress(60, 'Loading Object Detection models...');
            await this.loadObjectDetectionModels();
            
            this.updateLoadingProgress(90, 'Finalizing setup...');
            this.setupEventListeners();
            this.setupSessionId();
            
            this.updateLoadingProgress(100, 'System ready!');
            
            setTimeout(() => {
                this.showMainApp();
                this.isInitialized = true;
                this.logEvent('SYSTEM_INIT', 'Video proctoring system initialized successfully');
            }, 500);
            
        } catch (error) {
            console.error('System initialization failed:', error);
            this.updateLoadingProgress(0, 'Initialization failed: ' + error.message);
            this.showError('System initialization failed. Please refresh the page and try again.');
        }
    }
    
    // Setup camera
    async setupCamera() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });
        } catch (error) {
            throw new Error('Camera access denied. Please allow camera permissions.');
        }
    }
    
    // Load Face Detection models
    async loadFaceDetectionModels() {
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
            
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
        } catch (error) {
            console.warn('Face detection models failed to load:', error);
        }
    }
    
    // Load Object Detection models
    async loadObjectDetectionModels() {
        try {
            this.objectDetectionModel = await cocoSsd.load();
        } catch (error) {
            console.warn('Object detection model failed to load:', error);
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startInterview());
        this.pauseBtn.addEventListener('click', () => this.pauseInterview());
        this.stopBtn.addEventListener('click', () => this.stopInterview());
        this.screenshotBtn.addEventListener('click', () => this.takeScreenshot());
        this.reportBtn.addEventListener('click', () => this.showReport());
        
        // Modal event listeners
        document.getElementById('modalOkBtn').addEventListener('click', () => this.hideModal());
        document.getElementById('closeReportBtn').addEventListener('click', () => this.hideReport());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadReport());
    }
    
    // Setup session ID
    setupSessionId() {
        document.getElementById('sessionId').value = this.sessionId;
    }
    
    // Start interview
    async startInterview() {
        const candidateName = document.getElementById('candidateName').value.trim();
        
        if (!candidateName) {
            this.showAlert('Error', 'Please enter candidate name before starting the interview.');
            return;
        }
        
        if (!this.isInitialized) {
            this.showAlert('Error', 'System is still initializing. Please wait.');
            return;
        }
        
        try {
            // Update state
            this.isRunning = true;
            this.isPaused = false;
            this.startTime = Date.now();
            
            // Update UI
            this.updateSystemStatus('recording', 'Recording Interview');
            this.recordingIndicator.style.display = 'block';
            this.startBtn.disabled = true;
            this.pauseBtn.disabled = false;
            this.stopBtn.disabled = false;
            this.screenshotBtn.disabled = false;
            
            // Start detection loops
            this.startDetectionLoops();
            
            // Log event
            this.logEvent('INTERVIEW_START', `Interview started for candidate: ${candidateName}`);
            this.addAlert('success', `Interview started successfully for ${candidateName}`);
            
        } catch (error) {
            console.error('Failed to start interview:', error);
            this.addAlert('danger', 'Failed to start interview: ' + error.message);
        }
    }
    
    // Pause interview
    pauseInterview() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.updateSystemStatus('paused', 'Interview Paused');
            this.pauseBtn.innerHTML = '▶️ Resume';
            this.stopDetectionLoops();
            this.logEvent('INTERVIEW_PAUSE', 'Interview paused');
            this.addAlert('warning', 'Interview paused');
        } else {
            this.updateSystemStatus('recording', 'Recording Interview');
            this.pauseBtn.innerHTML = '⏸️ Pause';
            this.startDetectionLoops();
            this.logEvent('INTERVIEW_RESUME', 'Interview resumed');
            this.addAlert('info', 'Interview resumed');
        }
    }
    
    // Stop interview
    stopInterview() {
        // Update state
        this.isRunning = false;
        this.isPaused = false;
        
        // Stop detection loops
        this.stopDetectionLoops();
        
        // Calculate final duration
        if (this.startTime) {
            this.stats.duration = Math.floor((Date.now() - this.startTime) / 1000);
        }
        
        // Calculate final integrity score
        this.calculateIntegrityScore();
        
        // Update UI
        this.updateSystemStatus('stopped', 'Interview Stopped');
        this.recordingIndicator.style.display = 'none';
        this.startBtn.disabled = false;
        this.startBtn.innerHTML = '▶️ Start New Interview';
        this.pauseBtn.disabled = true;
        this.pauseBtn.innerHTML = '⏸️ Pause';
        this.stopBtn.disabled = true;
        this.screenshotBtn.disabled = true;
        this.reportBtn.disabled = false;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Log event
        this.logEvent('INTERVIEW_STOP', 'Interview stopped');
        this.addAlert('info', 'Interview stopped. Generate report to view results.');
    }
    
    // Start detection loops
    startDetectionLoops() {
        // Face detection loop
        this.detectionIntervals.face = setInterval(async () => {
            if (!this.isRunning || this.isPaused) return;
            await this.detectFaces();
        }, this.config.faceDetectionInterval);
        
        // Object detection loop
        this.detectionIntervals.object = setInterval(async () => {
            if (!this.isRunning || this.isPaused) return;
            await this.detectObjects();
        }, this.config.objectDetectionInterval);
        
        // Attention check loop
        this.detectionIntervals.attention = setInterval(() => {
            if (!this.isRunning || this.isPaused) return;
            this.checkAttention();
        }, this.config.attentionCheckInterval);
        
        // Stats update loop
        this.detectionIntervals.stats = setInterval(() => {
            if (!this.isRunning || this.isPaused) return;
            this.updateStats();
        }, 1000);
    }
    
    // Stop detection loops
    stopDetectionLoops() {
        Object.keys(this.detectionIntervals).forEach(key => {
            if (this.detectionIntervals[key]) {
                clearInterval(this.detectionIntervals[key]);
                this.detectionIntervals[key] = null;
            }
        });
    }
    
    // Detect faces
    async detectFaces() {
        try {
            if (!this.video || this.video.paused || this.video.ended) return;
            
            const detections = await faceapi
                .detectAllFaces(this.video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();
            
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            const now = Date.now();
            this.currentState.faces = detections.length;
            this.faceCount.textContent = detections.length;
            
            if (detections.length === 0) {
                // No face detected
                this.currentState.consecutiveNoFace++;
                this.updateStatusCard('faceStatusCard', 'danger', 'No Face Detected');
                this.statusText.textContent = 'No Face';
                
                if (this.currentState.consecutiveNoFace > (this.config.noFaceThreshold / this.config.faceDetectionInterval)) {
                    this.handleNoFaceDetected();
                }
                
            } else if (detections.length === 1) {
                // Single face - good
                this.currentState.consecutiveNoFace = 0;
                this.currentState.lastFaceTime = now;
                this.updateStatusCard('faceStatusCard', 'good', 'Face Detected');
                this.statusText.textContent = 'Focused';
                
                // Draw face detection box
                this.drawFaceBox(detections[0]);
                
                // Check attention based on landmarks
                this.checkFaceAttention(detections[0]);
                
            } else {
                // Multiple faces
                this.currentState.consecutiveNoFace = 0;
                this.updateStatusCard('faceStatusCard', 'danger', `${detections.length} Faces Detected`);
                this.statusText.textContent = 'Multiple Faces';
                this.handleMultipleFaces(detections.length);
                
                // Draw all face boxes
                detections.forEach(detection => this.drawFaceBox(detection, 'red'));
            }
            
        } catch (error) {
            console.error('Face detection error:', error);
        }
    }
    
    // Check face attention
    checkFaceAttention(detection) {
        try {
            const landmarks = detection.landmarks;
            if (!landmarks) return;
            
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const nose = landmarks.getNose();
            
            if (!leftEye || !rightEye || !nose) return;
            
            // Calculate eye centers
            const leftEyeCenter = this.getAveragePoint(leftEye);
            const rightEyeCenter = this.getAveragePoint(rightEye);
            const noseCenter = this.getAveragePoint(nose);
            
            // Simple attention check based on face angle
            const eyeDistance = Math.abs(leftEyeCenter.x - rightEyeCenter.x);
            const faceAngle = Math.abs(leftEyeCenter.y - rightEyeCenter.y);
            
            // Determine if looking away (simplified)
            const isLookingAway = faceAngle > eyeDistance * 0.3;
            
            if (isLookingAway) {
                this.currentState.consecutiveLookingAway++;
                this.updateStatusCard('attentionStatusCard', 'warning', 'Looking Away');
                
                if (this.currentState.consecutiveLookingAway > (this.config.focusLossThreshold / this.config.faceDetectionInterval)) {
                    this.handleLookingAway();
                }
            } else {
                this.currentState.consecutiveLookingAway = 0;
                this.currentState.lastAttentionTime = Date.now();
                this.updateStatusCard('attentionStatusCard', 'good', 'Attentive');
            }
            
        } catch (error) {
            console.error('Attention check error:', error);
        }
    }
    
    // Detect objects
    async detectObjects() {
        try {
            if (!this.objectDetectionModel || !this.video) return;
            
            const predictions = await this.objectDetectionModel.detect(this.video);
            const suspiciousFound = [];
            
            this.currentState.detectedObjects = predictions;
            
            predictions.forEach(prediction => {
                const objectName = prediction.class.toLowerCase();
                const confidence = prediction.score;
                
                if (confidence > this.config.confidenceThreshold) {
                    // Check if object is suspicious
                    const isSuspicious = this.suspiciousObjects.some(suspiciousObj => 
                        objectName.includes(suspiciousObj) || suspiciousObj.includes(objectName)
                    );
                    
                    if (isSuspicious) {
                        suspiciousFound.push(objectName);
                        this.handleSuspiciousObject(objectName, confidence);
                    }
                    
                    // Draw object detection box
                    this.drawObjectBox(prediction);
                }
            });
            
            this.objectCount.textContent = predictions.length;
            
            if (suspiciousFound.length > 0) {
                this.updateStatusCard('objectStatusCard', 'danger', `Suspicious: ${suspiciousFound.join(', ')}`);
            } else if (predictions.length > 0) {
                this.updateStatusCard('objectStatusCard', 'warning', `${predictions.length} Objects`);
            } else {
                this.updateStatusCard('objectStatusCard', 'good', 'No Suspicious Objects');
            }
            
        } catch (error) {
            console.error('Object detection error:', error);
        }
    }
    
    // Check attention
    checkAttention() {
        const now = Date.now();
        const timeSinceLastFace = now - this.currentState.lastFaceTime;
        const timeSinceLastAttention = now - this.currentState.lastAttentionTime;
        
        // Check for extended periods without attention
        if (timeSinceLastAttention > 30000) { // 30 seconds
            this.addAlert('warning', 'Extended period without attention detected');
        }
    }
    
    // Draw face detection box
    drawFaceBox(detection, color = 'green') {
        const { x, y, width, height } = detection.detection.box;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw confidence
        const confidence = Math.round(detection.detection.score * 100);
        this.ctx.fillStyle = color;
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Face: ${confidence}%`, x, y - 10);
    }
    
    // Draw object detection box
    drawObjectBox(prediction) {
        const [x, y, width, height] = prediction.bbox;
        
        this.ctx.strokeStyle = 'red';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        // Draw label
        const confidence = Math.round(prediction.score * 100);
        this.ctx.fillStyle = 'red';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`${prediction.class}: ${confidence}%`, x, y - 10);
    }
    
    // Event handlers
    handleNoFaceDetected() {
        this.stats.noFaceEvents++;
        this.stats.focusLossEvents++;
        this.logEvent('NO_FACE', 'No face detected for extended period');
        this.addAlert('danger', 'No face detected for over 10 seconds');
        this.currentState.consecutiveNoFace = 0;
    }
    
    handleLookingAway() {
        this.stats.focusLossEvents++;
        this.logEvent('LOOKING_AWAY', 'Candidate looking away for extended period');
        this.addAlert('warning', 'Looking away from camera for over 5 seconds');
        this.currentState.consecutiveLookingAway = 0;
    }
    
    handleMultipleFaces(count) {
        this.stats.multipleFaceEvents++;
        this.logEvent('MULTIPLE_FACES', `${count} faces detected simultaneously`);
        this.addAlert('danger', `Multiple faces detected: ${count}`);
    }
    
    handleSuspiciousObject(objectName, confidence) {
        this.stats.suspiciousItems++;
        this.logEvent('SUSPICIOUS_OBJECT', `${objectName} detected (${Math.round(confidence * 100)}% confidence)`);
        this.addAlert('danger', `Suspicious object detected: ${objectName}`);
    }
    
    // Update statistics
    updateStats() {
        // Update duration
        if (this.startTime) {
            this.stats.duration = Math.floor((Date.now() - this.startTime) / 1000);
            const hours = Math.floor(this.stats.duration / 3600);
            const minutes = Math.floor((this.stats.duration % 3600) / 60);
            const seconds = this.stats.duration % 60;
            
            document.getElementById('duration').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update other stats
        document.getElementById('focusLoss').textContent = this.stats.focusLossEvents;
        document.getElementById('suspiciousItems').textContent = this.stats.suspiciousItems;
        
        // Calculate and update integrity score
        this.calculateIntegrityScore();
        const scoreElement = document.getElementById('integrityScore');
        scoreElement.textContent = this.stats.integrityScore;
        
        // Update integrity status card
        const integrityCard = document.getElementById('integrityStatusCard');
        if (this.stats.integrityScore >= 80) {
            this.updateStatusCard('integrityStatusCard', 'good', `${this.stats.integrityScore}%`);
        } else if (this.stats.integrityScore >= 60) {
            this.updateStatusCard('integrityStatusCard', 'warning', `${this.stats.integrityScore}%`);
        } else {
            this.updateStatusCard('integrityStatusCard', 'danger', `${this.stats.integrityScore}%`);
        }
        
        // Update score styling
        const statBox = scoreElement.closest('.stat-box');
        statBox.className = 'stat-box integrity-score';
        if (this.stats.integrityScore < 60) {
            statBox.classList.add('danger');
        } else if (this.stats.integrityScore < 80) {
            statBox.classList.add('warning');
        }
    }
    
    // Calculate integrity score
    calculateIntegrityScore() {
        let score = 100;
        
        // Deductions based on violations
        score -= this.stats.focusLossEvents * 5;      // 5 points per focus loss
        score -= this.stats.suspiciousItems * 10;     // 10 points per suspicious item
        score -= this.stats.multipleFaceEvents * 15;  // 15 points per multiple face event
        score -= this.stats.noFaceEvents * 8;         // 8 points per no face event
        
        // Time-based penalties
        const durationMinutes = Math.ceil(this.stats.duration / 60);
        if (durationMinutes > 0) {
            const violationRate = (this.stats.focusLossEvents + this.stats.suspiciousItems) / durationMinutes;
            if (violationRate > 2) score -= 10; // High violation rate penalty
        }
        
        this.stats.integrityScore = Math.max(0, Math.round(score));
    }
    
    // Take screenshot
    takeScreenshot() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        
        ctx.drawImage(this.video, 0, 0);
        
        const timestamp = new Date().toISOString();
        const screenshot = {
            timestamp: timestamp,
            dataUrl: canvas.toDataURL('image/jpeg', 0.8),
            violations: this.getCurrentViolations()
        };
        
        this.stats.screenshots.push(screenshot);
        this.logEvent('SCREENSHOT', 'Screenshot captured');
        this.addAlert('info', 'Screenshot captured successfully');
    }
    
    // Get current violations
    getCurrentViolations() {
        const violations = [];
        if (this.currentState.faces === 0) violations.push('No face detected');
        if (this.currentState.faces > 1) violations.push('Multiple faces');
        if (!this.currentState.isAttentive) violations.push('Not attentive');
        if (this.currentState.detectedObjects.length > 0) violations.push('Objects detected');
        return violations;
    }
    
    // Show report
    showReport() {
        const reportSection = document.getElementById('reportSection');
        const reportContent = document.getElementById('reportContent');
        
        const candidateName = document.getElementById('candidateName').value || 'Unknown';
        const position = document.getElementById('position').value || 'Not specified';
        const interviewerId = document.getElementById('interviewerId').value || 'Not specified';
        
        const reportHTML = this.generateReportHTML(candidateName, position, interviewerId);
        reportContent.innerHTML = reportHTML;
        reportSection.style.display = 'block';
        reportSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Generate report HTML
    generateReportHTML(candidateName, position, interviewerId) {
        const duration = this.formatDuration(this.stats.duration);
        const timestamp = new Date().toLocaleString();
        
        let reportHTML = `
            <div class="report-header-info">
                <h4>📋 Interview Proctoring Report</h4>
                <div class="report-meta">
                    <p><strong>Generated:</strong> ${timestamp}</p>
                    <p><strong>Session ID:</strong> ${this.sessionId}</p>
                </div>
            </div>
            
            <div class="candidate-info">
                <h5>👤 Candidate Information</h5>
                <p><strong>Name:</strong> ${candidateName}</p>
                <p><strong>Position:</strong> ${position}</p>
                <p><strong>Interviewer ID:</strong> ${interviewerId}</p>
                <p><strong>Duration:</strong> ${duration}</p>
            </div>
            
            <div class="integrity-summary">
                <h5>⭐ Integrity Summary</h5>
                <div class="score-display">
                    <div class="score-circle ${this.getScoreClass()}">
                        ${this.stats.integrityScore}%
                    </div>
                    <div class="score-interpretation">
                        <p><strong>Interpretation:</strong> ${this.getScoreInterpretation()}</p>
                    </div>
                </div>
            </div>
            
            <div class="violation-summary">
                <h5>🚨 Violation Summary</h5>
                <div class="stats-table">
                    <div class="stat-row">
                        <span class="stat-name">Focus Loss Events:</span>
                        <span class="stat-value">${this.stats.focusLossEvents}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-name">Suspicious Items:</span>
                        <span class="stat-value">${this.stats.suspiciousItems}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-name">Multiple Face Events:</span>
                        <span class="stat-value">${this.stats.multipleFaceEvents}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-name">No Face Events:</span>
                        <span class="stat-value">${this.stats.noFaceEvents}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add event timeline if events exist
        if (this.eventLog.length > 0) {
            reportHTML += `
                <div class="event-timeline">
                    <h5>📅 Event Timeline</h5>
                    <div class="timeline-container">
            `;
            
            this.eventLog.forEach(event => {
                const eventTime = this.formatEventTime(event.timestamp);
                reportHTML += `
                    <div class="timeline-event ${this.getEventClass(event.type)}">
                        <span class="event-time">${eventTime}</span>
                        <span class="event-type">${event.type}</span>
                        <span class="event-description">${event.description}</span>
                    </div>
                `;
            });
            
            reportHTML += `
                    </div>
                </div>
            `;
        }
        
        // Add recommendations
        reportHTML += `
            <div class="recommendations">
                <h5>💡 Recommendations</h5>
                ${this.generateRecommendations()}
            </div>
        `;
        
        return reportHTML;
    }
    
    // Generate recommendations based on violations
    generateRecommendations() {
        let recommendations = '<ul>';
        
        if (this.stats.integrityScore >= 90) {
            recommendations += '<li class="good">✅ Excellent proctoring results. No major concerns detected.</li>';
        } else {
            if (this.stats.focusLossEvents > 3) {
                recommendations += '<li class="warning">⚠️ Multiple focus loss events detected. Consider reviewing attention monitoring protocols.</li>';
            }
            if (this.stats.suspiciousItems > 0) {
                recommendations += '<li class="danger">🚫 Suspicious items detected. Manual review recommended.</li>';
            }
            if (this.stats.multipleFaceEvents > 0) {
                recommendations += '<li class="danger">👥 Multiple faces detected. Verify candidate identity and environment.</li>';
            }
            if (this.stats.integrityScore < 70) {
                recommendations += '<li class="danger">❌ Low integrity score. Consider additional verification or re-examination.</li>';
            }
        }
        
        recommendations += '</ul>';
        return recommendations;
    }
    
    // Utility functions
    generateSessionId() {
        return 'INT_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    }
    
    formatEventTime(timestamp) {
        if (!this.startTime) return '00:00:00';
        const elapsed = Math.floor((timestamp - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    getScoreClass() {
        if (this.stats.integrityScore >= 80) return 'good';
        if (this.stats.integrityScore >= 60) return 'warning';
        return 'danger';
    }
    
    getScoreInterpretation() {
        if (this.stats.integrityScore >= 90) return 'Excellent - No major concerns';
        if (this.stats.integrityScore >= 80) return 'Good - Minor issues detected';
        if (this.stats.integrityScore >= 70) return 'Fair - Some concerns present';
        if (this.stats.integrityScore >= 60) return 'Poor - Multiple violations detected';
        return 'Critical - Major integrity concerns';
    }
    
    getEventClass(eventType) {
        const dangerEvents = ['NO_FACE', 'MULTIPLE_FACES', 'SUSPICIOUS_OBJECT'];
        const warningEvents = ['LOOKING_AWAY', 'INTERVIEW_PAUSE'];
        const successEvents = ['INTERVIEW_START', 'INTERVIEW_RESUME'];
        
        if (dangerEvents.includes(eventType)) return 'danger';
        if (warningEvents.includes(eventType)) return 'warning';
        if (successEvents.includes(eventType)) return 'success';
        return 'info';
    }
    
    getAveragePoint(points) {
        const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
        const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
        return { x, y };
    }
    
    // UI Helper functions
    updateLoadingProgress(percentage, message) {
        this.progressFill.style.width = percentage + '%';
        this.loadingStatus.textContent = message;
    }
    
    showMainApp() {
        this.loadingScreen.style.display = 'none';
        this.mainApp.style.display = 'block';
        this.mainApp.classList.add('fade-in');
    }
    
    updateSystemStatus(status, text) {
        this.systemStatus.className = `system-status ${status}`;
        this.systemStatus.textContent = text;
    }
    
    updateStatusCard(cardId, status, text) {
        const card = document.getElementById(cardId);
        if (card) {
            card.className = `status-card ${status}`;
            const valueElement = card.querySelector('.status-value');
            if (valueElement) {
                valueElement.textContent = text;
            }
        }
    }
    
    addAlert(type, message) {
        const alertLog = document.getElementById('alertLog');
        const timestamp = this.getFormattedTimestamp();
        
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
        `;
        
        // Insert at top
        alertLog.insertBefore(alert, alertLog.firstChild);
        
        // Keep only last 20 alerts
        const alerts = alertLog.querySelectorAll('.alert');
        if (alerts.length > 20) {
            alertLog.removeChild(alerts[alerts.length - 1]);
        }
        
        // Auto scroll to top
        alertLog.scrollTop = 0;
    }
    
    getFormattedTimestamp() {
        if (!this.startTime) return '00:00:00';
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    logEvent(type, description) {
        const event = {
            timestamp: Date.now(),
            type: type,
            description: description,
            sessionId: this.sessionId
        };
        this.eventLog.push(event);
        console.log('Event logged:', event);
    }
    
    showAlert(title, message) {
        const modal = document.getElementById('alertModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';
    }
    
    hideModal() {
        const modal = document.getElementById('alertModal');
        modal.style.display = 'none';
    }
    
    hideReport() {
        const reportSection = document.getElementById('reportSection');
        reportSection.style.display = 'none';
    }
    
    downloadReport() {
        const candidateName = document.getElementById('candidateName').value || 'Unknown';
        const reportContent = document.getElementById('reportContent').innerHTML;
        
        // Create a comprehensive report
        const fullReport = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Proctoring Report - ${candidateName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    .report-header-info { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
                    .candidate-info, .integrity-summary, .violation-summary, .event-timeline, .recommendations { margin-bottom: 30px; }
                    .score-circle { display: inline-block; width: 80px; height: 80px; border-radius: 50%; text-align: center; line-height: 80px; font-size: 24px; font-weight: bold; margin-right: 20px; }
                    .score-circle.good { background: #d4edda; color: #155724; }
                    .score-circle.warning { background: #fff3cd; color: #856404; }
                    .score-circle.danger { background: #f8d7da; color: #721c24; }
                    .stats-table { background: #f8f9fa; padding: 20px; border-radius: 8px; }
                    .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
                    .stat-row:last-child { border-bottom: none; }
                    .timeline-event { padding: 10px; margin-bottom: 10px; border-left: 4px solid #007bff; background: #f8f9fa; }
                    .timeline-event.danger { border-left-color: #dc3545; }
                    .timeline-event.warning { border-left-color: #ffc107; }
                    .timeline-event.success { border-left-color: #28a745; }
                    .event-time { font-weight: bold; margin-right: 15px; }
                    .event-type { background: #007bff; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 15px; }
                    ul { padding-left: 20px; }
                    li.good { color: #28a745; }
                    li.warning { color: #ffc107; }
                    li.danger { color: #dc3545; }
                </style>
            </head>
            <body>
                ${reportContent}
                <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
                    <p>Report generated by AI Video Proctoring System | Session ID: ${this.sessionId} | Generated: ${new Date().toLocaleString()}</p>
                </footer>
            </body>
            </html>
        `;
        
        // Create and download the file
        const blob = new Blob([fullReport], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Proctoring_Report_${candidateName.replace(/\s+/g, '_')}_${this.sessionId}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addAlert('success', 'Report downloaded successfully');
    }
    
    showError(message) {
        this.loadingStatus.textContent = message;
        this.loadingStatus.style.color = '#dc3545';
    }
}

// Initialize the system when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 AI Video Proctoring System - Starting...');
    new VideoProctoringSystem();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden - potential tab switch detected');
    } else {
        console.log('Page visible again');
    }
});

// Prevent certain keyboard shortcuts during interview
document.addEventListener('keydown', (e) => {
    // Disable F12, Ctrl+Shift+I, Ctrl+U, etc.
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') || 
        (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        console.log('Developer tools access attempt detected');
        return false;
    }
});

// Disable right-click context menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
});