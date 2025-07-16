// Prevents a function from being called too rapidly
function debounce(func, delay) {
    let timeoutId = null;
    return function (...args) {
        if (timeoutId) return;
        func.apply(this, args);
        timeoutId = setTimeout(() => {
            timeoutId = null;
        }, delay);
    };
}

window.onload = async () => {
    // Load audio and canvas context
    const fireSound = new Audio("/static/sounds/beep.wav");
    fireSound.volume = 0.3;
    const canvas = document.getElementById("brainCanvas");
    const ctx = canvas.getContext("2d");

    const neurons = [];
    const connections = [];
    let neuronRadius = 15;

    // Generate random position for a new neuron
    function getRandomPosition() {
        return {
            x: Math.random() * (canvas.width - 2 * neuronRadius) + neuronRadius,
            y: Math.random() * (canvas.height - 2 * neuronRadius) + neuronRadius,
        };
    }

    // Load network data from backend
    async function loadNetwork() {
        const res = await fetch("/api/get_network");
        if (!res.ok) return alert("Failed to load network!");
        const data = await res.json();

        neurons.length = 0;
        data.neurons.forEach(n => neurons.push({...n, fired: false}));
        connections.length = 0;
        data.connections.forEach(c => connections.push(c));

        draw();
    }

    // Load report data and display it
    async function loadReport() {
        const res = await fetch("/api/report");
        const area = document.getElementById("reportArea");

        if (!res.ok) {
            area.innerHTML = `<span class="text-danger">Error loading report</span>`;
            return;
        }

        const data = await res.json();
        let html = `<h5>Neuron Count: ${data.neurons.length}</h5>`;
        html += `<p>Connection Count: ${data.connections.length}</p><ul>`;
        data.neurons.forEach(n => {
            html += `<li>Neuron ID: ${n.id} (x=${n.x.toFixed(0)}, y=${n.y.toFixed(0)}, threshold=${n.threshold})</li>`;
        });
        html += "</ul>";
        area.innerHTML = html;

        window.latestReportData = data;
    }

    // Add a new neuron via API
    async function addNeuron() {
        const pos = getRandomPosition();
        const res = await fetch("/api/add_neuron", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(pos)
        });

        if (!res.ok) return;
        const data = await res.json();
        neurons.push({...data, fired: false});
    }

    // Connect two neurons via API
    async function connectNeurons(id1, id2) {
        const res = await fetch("/api/connect_neurons", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id1, id2}),
        });
        if (!res.ok) return;
        connections.push({from: id1, to: id2});
    }

    const cooldownMap = {};
    const firingMap = {};
    const activeConnectionAnimations = [];

    // Stimulate the network and trigger animation
    async function stimulate() {
        const res = await fetch("/api/stimulate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({}),
        });

        if (!res.ok) return;
        const data = await res.json();
        neurons.forEach(n => (n.fired = false));

        if (data.fired_neurons) {
            const now = Date.now();
            data.fired_neurons.forEach(fid => {
                const neuron = neurons.find(n => n.id === fid);
                if (neuron) {
                    neuron.fired = true;
                    cooldownMap[fid] = now;
                    firingMap[fid] = now;

                    connections.forEach(conn => {
                        if (conn.from === fid) {
                            const from = neuron;
                            const to = neurons.find(n => n.id === conn.to);
                            if (to) {
                                const dx = to.x - from.x;
                                const dy = to.y - from.y;
                                const duration = Math.sqrt(dx * dx + dy * dy) * 5;
                                activeConnectionAnimations.push({from, to, startTime: now, duration});
                            }
                        }
                    });

                    fireSound.currentTime = 0;
                    fireSound.play().catch(() => {
                    });
                }
            });
        }
    }

    // Draw network and animations
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        connections.forEach(conn => {
            const from = neurons.find(n => n.id === conn.from);
            const to = neurons.find(n => n.id === conn.to);
            if (from && to) {
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.strokeStyle = "#666";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        const now = Date.now();

        // Draw signal animations
        for (let i = activeConnectionAnimations.length - 1; i >= 0; i--) {
            const anim = activeConnectionAnimations[i];
            const elapsed = now - anim.startTime;
            if (elapsed > anim.duration) {
                activeConnectionAnimations.splice(i, 1);
                continue;
            }
            const t = elapsed / anim.duration;
            const x = anim.from.x + (anim.to.x - anim.from.x) * t;
            const y = anim.from.y + (anim.to.y - anim.from.y) * t;

            ctx.beginPath();
            ctx.arc(x, y, neuronRadius * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = "orange";
            ctx.shadowColor = "orange";
            ctx.shadowBlur = 10;
            ctx.fill();
        }

        // Draw neurons with states
        neurons.forEach(neuron => {
            const fireStart = firingMap[neuron.id];
            const lastFired = cooldownMap[neuron.id];
            const isCooldown = lastFired && (now - lastFired < 1000);

            // Ring animation when firing
            if (fireStart && (now - fireStart < 300)) {
                const elapsed = now - fireStart;
                const ringRadius = neuronRadius + (elapsed / 300) * neuronRadius * 0.75;
                const alpha = 1 - elapsed / 300;

                ctx.beginPath();
                ctx.arc(neuron.x, neuron.y, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                ctx.lineWidth = 4;
                ctx.stroke();
            }

            // Neuron body
            ctx.beginPath();
            ctx.arc(neuron.x, neuron.y, neuronRadius, 0, Math.PI * 2);

            if (fireStart && (now - fireStart) < 300) {
                const alpha = 1 - (now - fireStart) / 300;
                ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            } else if (isCooldown) {
                const ratio = 1 - (now - lastFired) / 1000;
                const gray = Math.floor(200 * ratio);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
            } else {
                ctx.fillStyle = "skyblue";
            }

            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "black";
            ctx.stroke();
            ctx.closePath();
        });
    }

    // Handle canvas neuron selection and connection
    let selectedNeuronId = null;
    canvas.addEventListener("click", event => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const clicked = neurons.find(n => {
            const dx = n.x - x;
            const dy = n.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= neuronRadius;
        });

        if (!clicked) return;
        if (!selectedNeuronId) {
            selectedNeuronId = clicked.id;
        } else if (selectedNeuronId !== clicked.id) {
            connectNeurons(selectedNeuronId, clicked.id);
            selectedNeuronId = null;
        }
    });

    // Keyboard shortcuts
    const debouncedStimulate = debounce(stimulate, 300);
    document.addEventListener("keydown", e => {
        if (e.key === "a") addNeuron();
        if (e.key === "s") debouncedStimulate();
        if (e.key === "r") {
            const confirmClear = confirm("Clear network?");
            if (confirmClear) document.getElementById("clearNetworkBtn").click();
        }
    });

    // Auto-connect neurons
    document.getElementById("autoConnectBtn").addEventListener("click", async () => {
        const res = await fetch("/api/auto_connect", {method: "POST"});
        if (res.ok) {
            alert("Auto connection done!");
            loadNetwork();
        } else {
            alert("Failed: " + await res.text());
        }
    });

    // Clear the network
    document.getElementById("clearNetworkBtn").addEventListener("click", async () => {
        if (!confirm("Clear the current network?")) return;
        const res = await fetch("/api/clear_network", {method: "POST"});
        if (res.ok) {
            neurons.length = 0;
            connections.length = 0;
            draw();
        } else {
            alert("Failed: " + await res.text());
        }
    });

    // Manual and auto stimulation
    document.getElementById("stimulateBtn").addEventListener("click", () => debouncedStimulate());
    document.getElementById("addNeuronBtn").addEventListener("click", () => addNeuron());

    let autoStimulate = false;
    let autoStimulateInterval = null;
    document.getElementById("autoStimulateBtn").addEventListener("click", () => {
        autoStimulate = !autoStimulate;
        const btn = document.getElementById("autoStimulateBtn");
        if (autoStimulate) {
            btn.textContent = "⏸️ Stop Auto Stimulate";
            autoStimulateInterval = setInterval(debouncedStimulate, 200);
        } else {
            btn.textContent = "🔁 Auto Stimulate";
            clearInterval(autoStimulateInterval);
        }
    });

    // Neuron size slider
    const sizeSlider = document.getElementById("neuronSizeSlider");
    const sizeLabel = document.getElementById("neuronSizeLabel");
    sizeSlider.addEventListener("input", () => {
        neuronRadius = parseInt(sizeSlider.value);
        sizeLabel.textContent = neuronRadius;
    });

    // CSV Export
    function exportCSV() {
        if (!window.latestReportData) return;
        const rows = [["Neuron ID", "X", "Y", "Threshold"]];
        window.latestReportData.neurons.forEach(n => rows.push([n.id, n.x, n.y, n.threshold]));
        const blob = new Blob([rows.map(r => r.join(",")).join("\n")], {type: "text/csv"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "network_report.csv";
        a.click();
    }

    document.getElementById("downloadCSV").addEventListener("click", exportCSV);

     // Handle canvas resizing
    function resizeCanvas() {
        const canvas = document.getElementById('brainCanvas');
        const containerWidth = canvas.parentElement.clientWidth;
        const ctx = canvas.getContext('2d');
        const ratio = window.devicePixelRatio || 1;

        canvas.width = containerWidth * ratio;
        canvas.height = Math.floor(containerWidth * 0.45 * ratio);
        canvas.style.width = containerWidth + "px";
        canvas.style.height = Math.floor(containerWidth * 0.45) + "px";

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    resizeCanvas();
    await loadNetwork();
    await loadReport();

    window.addEventListener("resize", resizeCanvas);

    // Render loop
    function loop() {
        draw();
        requestAnimationFrame(loop);
    }

    loop();
};
