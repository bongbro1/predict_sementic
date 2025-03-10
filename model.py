import pandas as pd
import numpy as np
import pickle
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, GlobalMaxPooling1D, LSTM, Embedding, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.utils import to_categorical
from sklearn.metrics import classification_report
from tensorflow.keras.layers import Reshape

# Tải các tài nguyên NLTK
nltk.download('stopwords')
nltk.download('wordnet')

# Bước 1: Tải dữ liệu
df = pd.read_csv('data/merged_data.csv')

# Bước 2: Mã hóa nhãn cảm xúc thành số
label_encoder = LabelEncoder()
df['label_encoded'] = label_encoder.fit_transform(df['label'])

# Bước 3: Xóa các dòng có giá trị NaN trong cột 'content'
df.dropna(subset=['content'], inplace=True)
X = df['content']
y = df['label_encoded']

# Bước 4: Phân chia dữ liệu thành tập huấn luyện và tập kiểm tra
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Bước 5: Tiền xử lý văn bản
stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

def preprocess_text(text):
    if isinstance(text, str):
        text = text.lower()
        text = re.sub(r'[^a-zA-ZÀ-ỹ\s]', '', text)
        tokens = text.split()
        tokens = [lemmatizer.lemmatize(word) for word in tokens if word not in stop_words]
        return ' '.join(tokens)
    else:
        return ''

# Tiến hành tiền xử lý dữ liệu
X_train = X_train.apply(preprocess_text)
X_test = X_test.apply(preprocess_text)

# Bước 6: Tokenization
tokenizer = Tokenizer()
tokenizer.fit_on_texts(X_train)

# Chuyển đổi văn bản thành chuỗi số
X_train_seq = tokenizer.texts_to_sequences(X_train)
X_test_seq = tokenizer.texts_to_sequences(X_test)

# Padding để các chuỗi có cùng chiều dài
maxlen = max([len(seq) for seq in X_train_seq])
X_train_pad = pad_sequences(X_train_seq, maxlen=maxlen, padding='post')
X_test_pad = pad_sequences(X_test_seq, maxlen=maxlen, padding='post')

# Chuyển đổi nhãn thành dạng one-hot
y_train = to_categorical(y_train, num_classes=len(label_encoder.classes_))
y_test = to_categorical(y_test, num_classes=len(label_encoder.classes_))

# Thiết lập early stopping
early_stopping = EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True)

# Xây dựng mô hình kết hợp CNN và LSTM
model_combined = Sequential()
model_combined.add(Embedding(input_dim=len(tokenizer.word_index) + 1, output_dim=128, input_length=maxlen))
model_combined.add(Conv1D(filters=128, kernel_size=5, activation='relu'))
model_combined.add(GlobalMaxPooling1D())
model_combined.add(Reshape((1, 128)))  # Thay đổi kích thước cho LSTM
model_combined.add(LSTM(128, return_sequences=False))
model_combined.add(Dense(len(label_encoder.classes_), activation='softmax'))
model_combined.compile(optimizer=Adam(learning_rate=0.0005), loss='categorical_crossentropy', metrics=['accuracy'])

# Huấn luyện mô hình kết hợp
model_combined.fit(X_train_pad, y_train, epochs=10, batch_size=10, validation_data=(X_test_pad, y_test), callbacks=[early_stopping])

# Đánh giá mô hình
cnn_loss, cnn_acc = model_combined.evaluate(X_test_pad, y_test)
print(f'Combined Model Loss: {cnn_loss}, Accuracy: {cnn_acc}')

# Đánh giá chi tiết
y_pred = model_combined.predict(X_test_pad)
y_pred_classes = np.argmax(y_pred, axis=1)
print(classification_report(y_test.argmax(axis=1), y_pred_classes, target_names=label_encoder.classes_))

# Lưu mô hình
model_combined.save('sentiment_model_combined.h5')

# Lưu Tokenizer
with open('tokenizer.pickle', 'wb') as handle:
    pickle.dump(tokenizer, handle, protocol=pickle.HIGHEST_PROTOCOL)

# Lưu Label Encoder
with open('label_encoder.pickle', 'wb') as handle:
    pickle.dump(label_encoder, handle, protocol=pickle.HIGHEST_PROTOCOL)
