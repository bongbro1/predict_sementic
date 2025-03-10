const emotionIcons = {
  2: "fas fa-smile", // Biểu tượng cho tâm trạng tích cực
  1: "fas fa-meh", // Biểu tượng cho tâm trạng trung lập
  0: "fas fa-frown", // Biểu tượng cho tâm trạng tiêu cực
};
const apiKey = "AIzaSyAkJQToiPYmKDxv65xw9HdC_-VgPhQw7ko";

// Đảm bảo ẩn preloader khi trang được tải
document.addEventListener("DOMContentLoaded", async function () {
  document.getElementById("preloader").style.visibility = "hidden";
  await fetchActivities("tích cực");
});

// Thiết lập các biến toàn cục cho việc thu âm
let recognition;
let isRecording = false;

// Kiểm tra xem trình duyệt có hỗ trợ Web Speech API không
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.interimResults = false; // Chỉ lấy kết quả cuối cùng
  recognition.lang = "vi-VN"; // Thiết lập ngôn ngữ

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript; // Lấy văn bản thu được
    let rs = document.getElementById("inputText").value;

    if (transcript.trim() !== "") {
      // Tách văn bản thành các câu
      const sentences = transcript.split(/(?<=[.!?])\s+/);

      // Viết hoa ký tự đầu tiên của mỗi câu
      const capitalizedSentences = sentences.map((sentence) => {
        return (
          sentence.charAt(0).toUpperCase() + sentence.slice(1).toLowerCase()
        ); // Viết hoa ký tự đầu và chữ thường cho phần còn lại
      });

      // Ghép lại các câu thành một chuỗi
      const formattedTranscript = capitalizedSentences.join(" ");

      // Cập nhật giá trị cho ô nhập liệu
      if (rs === "") {
        rs += formattedTranscript; // Nếu ô nhập liệu trống, thêm chuỗi đã xử lý
      } else {
        rs += ", " + formattedTranscript.toLowerCase(); // Nếu không, thêm chuỗi đã xử lý với dấu phẩy
      }
    }

    document.getElementById("inputText").value = rs; // Hiển thị vào input
  };

  recognition.onerror = (event) => {
    console.error("Error occurred in recognition: " + event.error);
  };

  recognition.onend = () => {
    if (isRecording) {
      // Nếu đang thu âm, tự động bắt đầu lại thu âm
      recognition.start();
    }
  };
}

// Xử lý sự kiện cho nút thu âm
document.getElementById("recordButton").addEventListener("click", () => {
  if (!isRecording) {
    // Bắt đầu thu âm
    document.getElementById("inputText").value = "";
    recognition.start();
    document.getElementById("recordButton").innerText = "Dừng thu âm"; // Thay đổi văn bản nút
    isRecording = true; // Đánh dấu là đang thu âm
  } else {
    // Dừng thu âm
    recognition.stop();
    document.getElementById("recordButton").innerText = "Bắt đầu thu âm"; // Khôi phục văn bản nút
    isRecording = false; // Đánh dấu là không còn thu âm
  }
});

// Xử lý sự kiện phân tích văn bản
document.getElementById("analyzeButton").onclick = async function () {
  const inputText = document.getElementById("inputText").value;
  if (inputText.trim() == "") {
    document.getElementById("result").innerHTML = `
            Vui lòng nhập nội dung
        `;

    return;
  }
  document.getElementById("preloader").style.visibility = "visible";

  // Gửi yêu cầu POST đến Flask
  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: inputText }), // Gửi nội dung văn bản
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    document.getElementById("result").innerHTML = `
            Bạn đang cảm thấy: ${data.prediction.emotion}
            
            <i class="${emotionIcons[data.prediction.label]}"></i>
        `;

    document.querySelector(".title_sugget_activities").innerText =
      "Tâm trạng của bạn đang '" +
      data.prediction.emotion.toLowerCase() +
      "' nên thực hiện các hoạt động:";

    await fetchActivities(data.prediction.emotion);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    document.getElementById("preloader").style.visibility = "hidden"; // Ẩn preloader
  }
};

async function generateContentWithGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const data = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return responseData; // Return the entire response object
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error; // Re-throw the error for the caller to handle
  }
}

//suggestion activities

async function fetchActivities(emotion) {
    try {
        let prompt = `Liệt kê cho tôi 10 hoạt động nên làm khi tôi cảm thấy ${emotion}, tôi chỉ cần bạn liệt kê tiêu đề không cần in đậm dưới dạng 1 đoạn văn bản ngăn cách nhau bở dấu /.`
        const result = await generateContentWithGemini(apiKey, prompt);
        // Access the generated text (if available)
        if (
          result.candidates &&
          result.candidates.length > 0 &&
          result.candidates[0].content &&
          result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0
        ) {
          const generatedText = result.candidates[0].content.parts[0].text;
          const activitiesList = generatedText.split('/').map(activity => activity.trim());

          displayActivities(activitiesList);
        } else {
          console.log("No generated text found in the response.");
        }
      } catch (error) {
        console.error("An error occurred:", error);
      }
}

function displayActivities(activities) {
  const suggestionsDiv = document.getElementById("activitySuggestions");
  suggestionsDiv.innerHTML = ""; // Xóa nội dung cũ

  const ul = document.createElement("ul");
  ul.classList.add("activity-list"); // Thêm class cho thẻ ul

  activities.forEach((activity) => {
    const li = document.createElement("li"); // Tạo thẻ li cho mỗi hoạt động
    li.classList.add("activity-item"); // Thêm class cho thẻ li
    li.textContent = activity; // Gán nội dung cho thẻ li
    ul.appendChild(li); // Thêm thẻ li vào thẻ ul
  });

  suggestionsDiv.appendChild(ul); // Thêm thẻ ul vào div chứa
}

// pháo hoa
document.addEventListener("DOMContentLoaded", () => {
  function createFirework() {
    // Tạo phần tử vệt thẳng
    const trail = document.createElement("div");
    trail.classList.add("trail");

    // Đặt vị trí ngẫu nhiên theo trục x
    const fireworkX = Math.random() * (window.innerWidth - 20);
    trail.style.left = `${fireworkX}px`;

    // Bắt đầu vệt từ phía trên cùng màn hình
    trail.style.bottom = "0px";

    // Đặt vị trí ngẫu nhiên theo trục y nơi vệt sẽ biến mất và pháo hoa sẽ nổ
    const fireworkY = Math.random() * (window.innerHeight - 100); // Giới hạn vị trí trên màn hình

    // Thêm vệt vào body
    document.body.appendChild(trail);
    const trailHeight = trail.offsetHeight;

    // Di chuyển vệt từ top đến vị trí ngẫu nhiên trên trục y
    trail.animate(
      [{ bottom: "0px" }, { bottom: `${fireworkY}px` }],
      { duration: 1000, easing: "ease-out" } // Thời gian di chuyển của vệt là 1 giây
    );

    // Sau khi vệt đến vị trí y, tạo pháo hoa tại vị trí đó và xóa vệt
    setTimeout(function () {
      // Xóa vệt
      trail.remove();

      // Tạo container cho pháo hoa tại vị trí vệt biến mất
      const fireworkContainer = document.createElement("div");
      fireworkContainer.classList.add("firework");

      // Đặt vị trí pháo hoa tại cùng tọa độ x và y của vệt
      fireworkContainer.style.left = `${fireworkX}px`;
      fireworkContainer.style.bottom = `${fireworkY + trailHeight}px`;

      // Tạo các hạt pháo hoa
      const fireworkColors = [
        "#ff0000",
        "#ffcc00",
        "#00ff00",
        "#0000ff",
        "#ff00ff",
      ]; // Màu sắc của hạt pháo hoa

      for (let i = 0; i < 20; i++) {
        const particle = document.createElement("div");
        particle.classList.add("particle");
        const randomColor =
          fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
        particle.style.backgroundColor = randomColor;

        // Tính toán vị trí ngẫu nhiên cho mỗi hạt
        const angle = Math.random() * 360;
        const radius = Math.random() * 100 + 50; // Bán kính ngẫu nhiên cho hạt bắn ra
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        // Đặt vị trí bằng CSS variable
        particle.style.setProperty("--x", `${x}px`);
        particle.style.setProperty("--y", `${y}px`);

        fireworkContainer.appendChild(particle);

        setTimeout(() => {
          particle.remove(); // Xóa hạt sau khi nổ
        }, 800);
      }

      // Thêm pháo hoa vào body
      document.body.appendChild(fireworkContainer);

      // Xóa pháo hoa sau khi nổ
      setTimeout(() => {
        fireworkContainer.remove();
      }, 2000);
    }, 1000); // Sau 1 giây, khi vệt kết thúc di chuyển
  }

  // Tạo pháo hoa mỗi 2 giây
  setInterval(createFirework, 2000);
});

// firework
const canvas = document.getElementById("fireworksCanvas");
const ctx = canvas.getContext("2d");

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Array to store particles
const particles = [];

// Function to get a random number within a range
const random = (min, max) => Math.random() * (max - min) + min;

// Particle class
class Particle {
  constructor(x, y, color, velocityX, velocityY, size, life) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.size = size;
    this.life = life; // How long the particle lives
    this.opacity = 1; // Opacity for fade-out effect
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
    ctx.fill();
  }

  update() {
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.opacity -= 1 / this.life; // Gradually fade out
    this.size *= 0.98; // Gradually shrink
  }
}

// Generate fireworks at a random position
function spawnFirework() {
  const x = random(canvas.width * 0.0, canvas.width);
  const y = random(canvas.height * 0.1, canvas.height * 0.8);
  const colors = [
    "255, 99, 71", // Tomato
    "144, 238, 144", // Light Green
    "135, 206, 250", // Sky Blue
    "255, 215, 0", // Gold
    "255, 105, 180", // Hot Pink
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];

  // Generate particles for the firework
  const particleCount = random(50, 100);
  for (let i = 0; i < particleCount; i++) {
    const angle = random(0, Math.PI * 2);
    const speed = random(2, 6);
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    const size = random(2, 4);
    const life = random(40, 60);
    particles.push(new Particle(x, y, color, velocityX, velocityY, size, life));
  }
}

// Animation loop
function animate() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // Fading trail effect
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.update();
    particle.draw();

    // Remove particles that are fully faded
    if (particle.opacity <= 0 || particle.size <= 0.2) {
      particles.splice(i, 1);
    }
  }

  // Randomly spawn fireworks
  if (Math.random() < 0.03) {
    spawnFirework();
  }

  // Request the next frame
  requestAnimationFrame(animate);
}

// Handle window resize
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Start animation
animate();
