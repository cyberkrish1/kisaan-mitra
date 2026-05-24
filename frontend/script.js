// frontend/script.js

const API_URL = "http://localhost:5000/predict";
let selectedFile = null;
let previousResults = [];

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", function () {
  initializeEventListeners();
  setupServiceWorker();
  loadCachedResults();
});

function initializeEventListeners() {
  // File input
  const fileInput = document.getElementById("file-input");
  fileInput.addEventListener("change", function () {
    if (this.files[0]) handleFile(this.files[0]);
  });

  // Drag and drop
  const uploadArea = document.getElementById("upload-area");
  uploadArea.addEventListener("dragover", handleDragOver);
  uploadArea.addEventListener("dragleave", handleDragLeave);
  uploadArea.addEventListener("drop", handleDrop);
  uploadArea.addEventListener("click", () => fileInput.click());

  // Image filters
  document.getElementById("brightness-slider").addEventListener("input", updateImageFilters);
  document.getElementById("contrast-slider").addEventListener("input", updateImageFilters);

  // Navigation
  document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
    link.addEventListener("click", handleNavigation);
  });

  // Hamburger menu
  const hamburger = document.getElementById("hamburger");
  hamburger.addEventListener("click", toggleMobileMenu);

  // Contact form
  document.getElementById("contact-form").addEventListener("submit", handleContactForm);

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

// ===== File Handling =====
function handleFile(file) {
  // Validate file
  if (!file.type.startsWith("image/")) {
    showError("Please select a valid image file (JPG, PNG, WebP)");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showError("File size must be less than 10MB");
    return;
  }

  selectedFile = file;
  const reader = new FileReader();

  reader.onload = function (e) {
    const img = document.getElementById("preview-img");
    img.src = e.target.result;

    // Cache image temporarily
    sessionStorage.setItem("lastImage", e.target.result);

    document.getElementById("upload-area").style.display = "none";
    document.getElementById("preview-section").style.display = "block";
    document.getElementById("result-card").style.display = "none";
    document.getElementById("error-box").style.display = "none";

    // Reset filters
    document.getElementById("brightness-slider").value = 100;
    document.getElementById("contrast-slider").value = 100;
    updateImageFilters();
  };

  reader.onerror = function () {
    showError("Error reading file. Please try again.");
  };

  reader.readAsDataURL(file);
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById("upload-area").style.borderColor = "#1D9E75";
  document.getElementById("upload-area").style.backgroundColor = "rgba(29, 158, 117, 0.05)";
}

function handleDragLeave() {
  document.getElementById("upload-area").style.borderColor = "#ccc";
  document.getElementById("upload-area").style.backgroundColor = "white";
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("upload-area").style.borderColor = "#ccc";
  document.getElementById("upload-area").style.backgroundColor = "white";

  if (e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
}

// ===== Image Filters =====
function updateImageFilters() {
  const brightness = document.getElementById("brightness-slider").value;
  const contrast = document.getElementById("contrast-slider").value;
  const img = document.getElementById("preview-img");

  img.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  document.getElementById("brightness-value").textContent = brightness + "%";
  document.getElementById("contrast-value").textContent = contrast + "%";
}

// ===== Image Analysis =====
async function analyzeImage() {
  if (!selectedFile) return;

  const btn = document.getElementById("analyze-btn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

  document.getElementById("loading").style.display = "flex";
  document.getElementById("preview-section").style.display = "none";
  document.getElementById("error-box").style.display = "none";
  document.getElementById("result-card").style.display = "none";

  const formData = new FormData();
  formData.append("image", selectedFile);

  try {
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    // Cache results
    cacheResult(data);

    showResult(data);

  } catch (err) {
    if (err.name === "AbortError") {
      showError("Request timed out. Please check if the Flask server is running on port 5000.");
    } else {
      showError(`Error: ${err.message}. Make sure the Flask server is running on port 5000.`);
    }
    document.getElementById("preview-section").style.display = "block";
  } finally {
    document.getElementById("loading").style.display = "none";
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Analyze Plant';
  }
}

// ===== Error Handling =====
function showError(message) {
  const errorBox = document.getElementById("error-box");
  const errorMessage = document.getElementById("error-message");

  errorMessage.textContent = message;
  errorBox.style.display = "flex";

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (errorBox.style.display === "flex") {
      errorBox.style.display = "none";
    }
  }, 10000);

  // Log error for debugging
  console.error("[Plant Disease Detector]", message);
}

// ===== Results Display =====
function showResult(data) {
  const isHealthy = data.is_healthy;

  const resultHeader = document.getElementById("result-header");
  resultHeader.className = "result-header " + (isHealthy ? "healthy" : "diseased");

  document.getElementById("result-disease").textContent = data.disease;
  document.getElementById("result-plant").textContent = `Plant: ${data.plant}`;

  const badge = document.getElementById("confidence-badge");
  badge.textContent = data.confidence.toFixed(1) + "%";
  badge.className = "confidence-badge" + (data.confidence < 60 ? " low" : "");

  const statusTag = document.getElementById("status-tag");
  statusTag.textContent = isHealthy ? "✓ Healthy" : "⚠ Disease Detected";
  statusTag.className = "status-tag " + (isHealthy ? "healthy" : "diseased");

  document.getElementById("result-treatment").textContent = data.treatment;

  // Top 3 predictions with animation
  const top3Html = data.top3.map((item, index) => {
    const parts = item.class.split("___");
    const label = (parts[1] || parts[0]).replace(/_/g, " ");
    const width = item.confidence.toFixed(1);
    return `
      <div class="top3-item" style="animation-delay: ${index * 0.1}s;">
        <span class="top3-name">${label}</span>
        <div class="top3-bar-wrap">
          <div class="top3-bar" style="width:${width}%; --width:${width}%"></div>
        </div>
        <span class="top3-pct">${width}%</span>
      </div>`;
  }).join("");

  document.getElementById("top3-list").innerHTML = top3Html;

  document.getElementById("result-card").style.display = "block";

  // Scroll to results
  setTimeout(() => {
    document.getElementById("result-card").scrollIntoView({ behavior: "smooth" });
  }, 300);
}

// ===== Download & Share =====
function downloadResult() {
  const disease = document.getElementById("result-disease").textContent;
  const plant = document.getElementById("result-plant").textContent;
  const status = document.getElementById("status-tag").textContent;
  const treatment = document.getElementById("result-treatment").textContent;
  const confidence = document.getElementById("confidence-badge").textContent;

  const reportText = `
KISAAN MITRA - PLANT DISEASE DETECTION REPORT
===============================================

Disease: ${disease}
${plant}
Confidence: ${confidence}
Status: ${status}

TREATMENT & PREVENTION:
${treatment}

Generated: ${new Date().toLocaleString()}
Powered by MobileNetV2 + TensorFlow
  `;

  const blob = new Blob([reportText], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plant-disease-report-${Date.now()}.txt`;
  link.click();
  window.URL.revokeObjectURL(url);
}

function shareResult() {
  const disease = document.getElementById("result-disease").textContent;
  const confidence = document.getElementById("confidence-badge").textContent;

  const text = `I just detected a plant disease using Kisaan Mitra AI! Disease: ${disease} (${confidence} confidence). Try it yourself at our website! 🌿`;

  if (navigator.share) {
    navigator.share({
      title: "Kisaan Mitra - Plant Disease Detection",
      text: text,
      url: window.location.href
    }).catch(err => console.log("Share failed:", err));
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      showError("Results copied to clipboard!");
    });
  }
}

// ===== Reset =====
function resetApp() {
  selectedFile = null;
  document.getElementById("file-input").value = "";
  document.getElementById("upload-area").style.display = "block";
  document.getElementById("upload-area").style.backgroundColor = "white";
  document.getElementById("upload-area").style.borderColor = "#ccc";
  document.getElementById("preview-section").style.display = "none";
  document.getElementById("result-card").style.display = "none";
  document.getElementById("error-box").style.display = "none";
  document.getElementById("loading").style.display = "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===== Navigation =====
function handleNavigation(e) {
  const section = e.target.closest("button").dataset.section;

  // Update active state
  document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
    link.setAttribute("aria-current", link.dataset.section === section ? "page" : "false");
  });

  // Close mobile menu
  document.getElementById("mobile-menu").classList.remove("active");
  document.getElementById("hamburger").classList.remove("active");
  document.getElementById("mobile-menu").setAttribute("aria-hidden", "true");

  // Scroll to section
  const element = document.getElementById(section);
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const hamburger = document.getElementById("hamburger");

  menu.classList.toggle("active");
  hamburger.classList.toggle("active");
  menu.setAttribute("aria-hidden", !menu.classList.contains("active"));
}

// ===== Scroll-to-Analyze =====
function scrollToAnalyze() {
  document.getElementById("analyzer").scrollIntoView({ behavior: "smooth" });
}

// ===== Contact Form =====
function handleContactForm(e) {
  e.preventDefault();

  const name = document.getElementById("contact-name").value.trim();
  const email = document.getElementById("contact-email").value.trim();
  const message = document.getElementById("contact-message").value.trim();

  if (!name || !email || !message) {
    showError("Please fill in all fields");
    return;
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError("Please enter a valid email address");
    return;
  }

  // Here you would send the form data to your backend
  console.log("Contact form submitted:", { name, email, message });

  // Show success
  showError("Thank you! Your message has been sent successfully. We'll get back to you soon!");

  // Reset form
  document.getElementById("contact-form").reset();
}

// ===== Keyboard Shortcuts =====
function handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + U: Open file picker
  if ((e.ctrlKey || e.metaKey) && e.key === "u") {
    e.preventDefault();
    document.getElementById("file-input").click();
  }

  // Ctrl/Cmd + Enter: Analyze
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (document.getElementById("preview-section").style.display === "block") {
      analyzeImage();
    }
  }
}

// ===== Caching & Storage =====
function cacheResult(data) {
  previousResults.unshift({
    ...data,
    timestamp: new Date().toISOString()
  });

  // Keep only last 10 results
  if (previousResults.length > 10) {
    previousResults.pop();
  }

  localStorage.setItem("plantDiseaseResults", JSON.stringify(previousResults));
}

function loadCachedResults() {
  const cached = localStorage.getItem("plantDiseaseResults");
  if (cached) {
    previousResults = JSON.parse(cached);
  }
}

// ===== Service Worker (for offline support) =====
function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    // Check if a service worker file exists, if not, skip
    navigator.serviceWorker.register("sw.js").catch(() => {
      console.log("Service worker not available");
    });
  }
}

// ===== Performance Optimization =====
// Lazy load images
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          observer.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll("img[data-src]").forEach(img => observer.observe(img));
}

// Debounce function for filter updates
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ===== Accessibility Helpers =====
// Announce to screen readers
function announceToScreenReader(message) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    announcement.remove();
  }, 1000);
}

// Log version and ready message
console.log("%cKisaan Mitra v2.0", "color: #1D9E75; font-size: 16px; font-weight: bold;");
console.log("%cPlant Disease Detection AI - Enhanced Version", "color: #666; font-size: 12px;");