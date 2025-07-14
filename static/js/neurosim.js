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

window.onload = () => {
    const fireSound = new Audio("/static/sounds/beep.wav");
    fireSound.volume = 0.3;
    const canvas = document.getElementById("brainCanvas");
    const ctx = canvas.getContext("2d");
    const neurons = [];
    let neuronRadius = 15;
    const connections = [];

    function getRandomPosition() {
        return {
            x: Math.random() * (canvas.width - 2 * neuronRadius) + neuronRadius,
            y: Math.random() * (canvas.height - 2 * neuronRadius) + neuronRadius,
        };
    }

    async function loadNetwork() {
        const res = await fetch("/api/get_network");
        if (!res.ok) {
            const text = await res.text();
            console.error("Failed to load network:", text);
            alert("Failed to load network!");
            return;
        }
        const data = await res.json();

        neurons.length = 0;
        data.neurons.forEach(n => {
            neurons.push({
                id: n.id,
                threshold: n.threshold,
                x: n.x,
                y: n.y,
                fired: false,
            });
        });

        connections.length = 0;
        data.connections.forEach(c => connections.push(c));

        draw();
    }

    async function loadReport() {
        const res = await fetch("/api/report");
        const area = document.getElementById("reportArea");

        if (!res.ok) {
            const text = await res.text();
            area.innerHTML = `<span class="text-danger">Error loading report: ${text}</span>`;
            return;
        }

        const data = await res.json();
        let html = `<h5>Neuron Count: ${data.neurons.length}</h5>`;
        html += `<p>Connection Count: ${data.connections.length}</p>`;

        html += "<ul>";
        data.neurons.forEach(n => {
            console.log(n);
            html += `<li>Neuron ID: ${n.id} (x=${n.x.toFixed(0)}, y=${n.y.toFixed(0)}, threshold=${n.threshold})</li>`;
        });
        html += "</ul>";

        area.innerHTML = html;

        window.latestReportData = data;
    }


    async function addNeuron() {
        const pos = getRandomPosition();
        const res = await fetch("/api/add_neuron", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({x: pos.x, y: pos.y})
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("API Error:", text);
            return;
        }

        const data = await res.json();

        neurons.push({
            id: data.id,
            threshold: data.threshold,
            x: data.x,
            y: data.y,
            fired: false,
        });

    }

    async function connectNeurons(id1, id2) {
        const res = await fetch("/api/connect_neurons", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id1, id2}),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("Error connecting neurons:", text);
            return;
        }

        const data = await res.json();
        console.log(data.message);

        connections.push({from: id1, to: id2});
    }

    const cooldownMap = {};
    const firingMap = {};
    const activeConnectionAnimations = [];

    async function stimulate() {
        const res = await fetch("/api/stimulate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({}),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("API Error:", text);
            return;
        }

        const data = await res.json();
        neurons.forEach(n => (n.fired = false));

        if (data.fired_neurons) {
            const now = Date.now();
            data.fired_neurons.forEach(fid => {
                const neuron = neurons.find(n => n.id === fid);
                if (neuron) {
                    neuron.fired = true;
                    cooldownMap[fid] = now;
                    firingMap[fid] = now

                    connections.forEach(conn => {
                        if (conn.from === fid) {
                            const fromNeuron = neuron;
                            const toNeuron = neurons.find(n => n.id === conn.to);
                            if (toNeuron) {
                                const dx = toNeuron.x - fromNeuron.x;
                                const dy = toNeuron.y - fromNeuron.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                const duration = dist * 5;

                                activeConnectionAnimations.push({
                                    from: fromNeuron,
                                    to: toNeuron,
                                    startTime: now,
                                    duration: duration
                                });
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

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        connections.forEach(conn => {
            const fromNeuron = neurons.find(n => n.id === conn.from);
            const toNeuron = neurons.find(n => n.id === conn.to);
            if (fromNeuron && toNeuron) {
                ctx.beginPath();
                ctx.moveTo(fromNeuron.x, fromNeuron.y);
                ctx.lineTo(toNeuron.x, toNeuron.y);
                ctx.strokeStyle = "#666";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        const now = Date.now();
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

        neurons.forEach(neuron => {
            const fireStart = firingMap[neuron.id];
            const now = Date.now();
            if (fireStart) {
                const elapsed = now - fireStart;
                if (elapsed < 300) {
                    const maxRingRadius = neuronRadius + 5;
                    const ringRadius = neuronRadius + (elapsed / 300) * neuronRadius * 0.75;
                    const alpha = 1 - elapsed / 300;

                    ctx.beginPath();
                    ctx.arc(neuron.x, neuron.y, ringRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                    ctx.lineWidth = 4;
                    ctx.stroke();
                } else {
                    delete firingMap[neuron.id];
                }
            }

            ctx.beginPath();
            ctx.arc(neuron.x, neuron.y, neuronRadius, 0, Math.PI * 2);

            const lastFired = cooldownMap[neuron.id];
            const isCooldown = lastFired && (now - lastFired < 1000);

            if (fireStart && (now - fireStart) < 300) {
                const alpha = 1 - (now - fireStart) / 300;
                ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            } else if (isCooldown) {
                const cooldownRatio = 1 - (now - lastFired) / 1000;
                const grayLevel = Math.floor(200 * cooldownRatio);
                ctx.fillStyle = `rgb(${grayLevel}, ${grayLevel}, ${grayLevel})`;
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

    let selectedNeuronId = null;

    canvas.addEventListener("click", event => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const clickedNeuron = neurons.find(n => {
            const dx = n.x - mouseX;
            const dy = n.y - mouseY;
            return Math.sqrt(dx * dx + dy * dy) <= neuronRadius;
        });

        if (!clickedNeuron) return;

        if (!selectedNeuronId) {
            selectedNeuronId = clickedNeuron.id;
            console.log(`Selected neuron ${selectedNeuronId}. Click another neuron to connect.`);
        } else {
            if (selectedNeuronId !== clickedNeuron.id) {
                connectNeurons(selectedNeuronId, clickedNeuron.id);
                selectedNeuronId = null;
            } else {
                console.log("Cannot connect neuron to itself.");
            }
        }
    });
    const debouncedStimulate = debounce(stimulate, 300);

    document.addEventListener("keydown", async e => {
        if (e.key === "a") addNeuron();
        if (e.key === "s") debouncedStimulate();
        if (e.key === "r") {
            const confirmed = confirm("Clear network?");
            if (confirmed) document.getElementById("clearNetworkBtn").click();
        }
    });


    document.getElementById("autoConnectBtn").addEventListener("click", async () => {
        const res = await fetch("/api/auto_connect", {method: "POST"});
        if (res.ok) {
            alert("Auto connection done!");
            loadNetwork();
        } else {
            const text = await res.text();
            alert("Failed to auto connect neurons: " + text);
        }
    });

    document.getElementById("clearNetworkBtn").addEventListener("click", async () => {
        const confirmed = confirm("Are you sure you want to clear the current network?");
        if (!confirmed) return;

        const res = await fetch("/api/clear_network", {method: "POST"});
        if (res.ok) {
            alert("Network cleared.");
            neurons.length = 0;
            connections.length = 0;
            draw();
        } else {
            const text = await res.text();
            alert("Failed to clear network: " + text);
        }
    });

    document.getElementById("stimulateBtn").addEventListener("click", () => {
        debouncedStimulate();
    });

    document.getElementById("addNeuronBtn").addEventListener("click", () => {
        addNeuron();
    });

    let autoStimulate = false;
    let autoStimulateInterval = null;

    document.getElementById("autoStimulateBtn").addEventListener("click", () => {
        autoStimulate = !autoStimulate;

        const btn = document.getElementById("autoStimulateBtn");
        if (autoStimulate) {
            btn.textContent = "⏸️ Stop Auto Stimulate";
            autoStimulateInterval = setInterval(() => {
                debouncedStimulate();
            }, 200);
        } else {
            btn.textContent = "🔁 Auto Stimulate";
            clearInterval(autoStimulateInterval);
            autoStimulateInterval = null;
        }
    });

    if (autoStimulateInterval) {
        clearInterval(autoStimulateInterval);
        autoStimulateInterval = null;
        autoStimulate = false;
        document.getElementById("autoStimulateBtn").textContent = "🔁 Auto Stimulate";
    }
    const sizeSlider = document.getElementById("neuronSizeSlider");
    const sizeLabel = document.getElementById("neuronSizeLabel");

    sizeSlider.addEventListener("input", () => {
        neuronRadius = parseInt(sizeSlider.value);
        sizeLabel.textContent = neuronRadius;
    });

    const canvasWidthInput = document.getElementById("canvasWidth");

    canvasWidthInput.addEventListener("input", () => {
        const newWidth = parseInt(canvasWidthInput.value);
        if (!isNaN(newWidth)) {
            canvas.width = newWidth;
            draw();
        }
    });

    function exportCSV() {
        if (!window.latestReportData) return;
        const rows = [["Neuron ID", "X", "Y", "Threshold"]];
        window.latestReportData.neurons.forEach(n => {
            rows.push([n.id, n.x, n.y, n.threshold]);
        });

        let csv = rows.map(row => row.join(",")).join("\n");
        const blob = new Blob([csv], {type: "text/csv"});
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "network_report.csv";
        a.click();
    }


    document.getElementById("downloadCSV").addEventListener("click", exportCSV);


    loadNetwork();

    loadReport();


    function loop() {
        draw();
        requestAnimationFrame(loop);
    }

    loop();

};
