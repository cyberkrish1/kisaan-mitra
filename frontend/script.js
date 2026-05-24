const API_URL = window.location.origin;  // Automatically uses deployed URL

async function uploadImage() {
    const fileInput = document.getElementById('imageInput');
    const file = fileInput.files[0];

    if (!file) {
        showError('Please select an image');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    document.getElementById('loading').style.display = 'block';
    document.getElementById('result').style.display = 'none';
    document.getElementById('error').style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Prediction failed');
            return;
        }

        displayResult(data);
    } catch (error) {
        showError(`Error: ${error.message}`);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function displayResult(data) {
    document.getElementById('plantName').textContent = 
        data.is_healthy ? '✅ Healthy Plant' : `🚨 ${data.plant}`;
    
    document.getElementById('diseaseName').textContent = 
        data.disease ? `Disease: ${data.disease}` : '';
    
    document.getElementById('confidence').textContent = 
        `Confidence: ${data.confidence}%`;
    
    document.getElementById('treatment').innerHTML = 
        `<p><strong>Treatment:</strong> ${data.treatment}</p>`;
    
    const top3Html = data.top3.map(item => 
        `<p>${item.class}: ${item.confidence}%</p>`
    ).join('');
    document.getElementById('top3').innerHTML = top3Html;

    document.getElementById('result').style.display = 'block';
}

function showError(message) {
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}