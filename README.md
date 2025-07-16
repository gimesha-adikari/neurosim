# NeuroSim – Brain Network Simulator
#### Video Demo: https://youtu.be/T5gbVfma4Ro

## Description:
NeuroSim is a browser-based neural network simulator designed as a final project for CS50 2025. It allows users to visually build and stimulate biological-like neural networks using an intuitive HTML5 canvas interface. Neurons can be added manually or automatically connected. Each neuron has a threshold value, and when stimulated, it fires and may trigger connected neurons depending on their thresholds.

This interactive app visualizes how neurons interact through connections, simulates firing activity with audio-visual feedback, and provides report export options. It combines real-time rendering, asynchronous backend APIs, and user-friendly controls, making it both educational and fun.

---

## Technologies Used
- Python 3
- Flask
- JavaScript
- HTML5
- CSS3
- SQLite3
- Bootstrap 5
- Audio (beep.wav)

---

## How to Run the Project

### 1. Clone the repo:
```bash
git clone https://github.com/gimesha-adikari/neurosim.git
cd neurosim
```

### 2. Install dependencies:
```bash
pip install -r requirements.txt
```

### 3. Run the Flask app:
```bash
flask run
```

### 4. Open the browser:
Visit: [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Keyboard Shortcuts
| Key | Action                   |
|-----|--------------------------|
| A   | Add a new neuron         |
| S   | Stimulate the network    |
| R   | Reset / Clear the network|

---

## API Endpoints
| Route                  | Method | Description                               |
|------------------------|--------|-------------------------------------------|
| `/api/add_neuron`      | POST   | Adds a new neuron to the network          |
| `/api/connect_neurons` | POST   | Connects two neurons                      |
| `/api/get_network`     | GET    | Retrieves all neurons and connections     |
| `/api/stimulate`       | POST   | Stimulates the network                    |
| `/api/auto_connect`    | POST   | Automatically connects all neurons        |
| `/api/clear_network`   | POST   | Clears all neurons and connections        |
| `/api/report`          | GET    | Returns neuron and connection summary     |

---

## Why This Project?
Understanding how neurons communicate in networks is fundamental to neuroscience and artificial intelligence. NeuroSim is an attempt to visualize that concept in an intuitive and interactive way. It blends frontend canvas rendering, backend logic, sound, animation, and user control to deliver a complete educational experience.

---

## Acknowledgments
- Harvard CS50 Staff and Community
- Mozilla Developer Docs (Canvas & Audio)
- Stack Overflow Contributors

---

**Made by Gimesha Nirmal – CS50 2025 Final Project**