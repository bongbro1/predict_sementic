from flask import Flask, request, jsonify, render_template
from tensorflow.keras.models import load_model
import pickle, re, requests
import numpy as np
from tensorflow.keras.preprocessing.sequence import pad_sequences

app = Flask(__name__)

# Tải mô hình và các đối tượng
model = load_model('sentiment_model_combined.h5')

with open('tokenizer.pickle', 'rb') as handle:
    tokenizer = pickle.load(handle)

with open('label_encoder.pickle', 'rb') as handle:
    label_encoder = pickle.load(handle)

maxlen = 100  # Đặt chiều dài tối đa giống như trong mô hình

# Hàm tiền xử lý văn bản
def preprocess_text(text):
    if isinstance(text, str):
        text = text.lower()
        text = re.sub(r'[^a-zA-Z0-9\sÀ-ỹ]', '', text)
        return text
    return ''


# Route cho trang chính
@app.route('/')
def index():
    return render_template('index.html')  # Trả về tệp index.html

# Hàm dự đoán
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()  # Lấy dữ liệu từ yêu cầu
    text = data['text']  # Truy xuất văn bản từ dữ liệu
    prediction = predict_sentiment(text)  # Gọi hàm dự đoán
    result = {
        'emotion': prediction[0],  # Cảm xúc con
        'label': prediction[1]      # Loại nhãn (0, 1, hoặc 2)
    }
    return jsonify({'prediction': result})


def predict_sentiment(text):
    # Tải mô hình
    model = load_model('sentiment_model_combined.h5')

    # Tải Tokenizer
    with open('tokenizer.pickle', 'rb') as handle:
        tokenizer = pickle.load(handle)

    # Tải Label Encoder
    with open('label_encoder.pickle', 'rb') as handle:
        label_encoder = pickle.load(handle)

    # Tiền xử lý văn bản
    processed_text = preprocess_text(text)

    # Chuyển đổi văn bản thành chuỗi số
    text_seq = tokenizer.texts_to_sequences([processed_text])

    # Padding để chiều dài giống như mô hình đã huấn luyện
    text_pad = pad_sequences(text_seq, maxlen=maxlen, padding='post')

    # Dự đoán
    prediction = model.predict(text_pad)

    # Lấy nhãn có xác suất cao nhất
    predicted_label = int(np.argmax(prediction, axis=1)[0])  # Chuyển về số nguyên

    # Ánh xạ nhãn sang cảm xúc con
    label_mapping = {
        0: 'Tiêu cực',  # Tiêu cực
        1: 'Trung tính',  # Bình thường
        2: 'Tích cực'  # Tích cực
    }

    # Lấy trạng thái cảm xúc tương ứng với nhãn dự đoán
    result = (label_mapping.get(predicted_label, 'Không xác định'), str(predicted_label))
    return result  # Kết quả sẽ là một tuple như ('Buồn', '0')





if __name__ == '__main__':
    app.run(debug=True)
