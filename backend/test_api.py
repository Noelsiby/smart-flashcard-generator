import requests

data = {"name": "test3", "email": "test3@test.com", "password": "password123"}
r = requests.post("http://localhost:8000/auth/signup", json=data)
print("SIGNUP:", r.status_code, r.text)

login_data = {"email": "test3@test.com", "password": "password123"}
r2 = requests.post("http://localhost:8000/auth/login", json=login_data)
print("LOGIN:", r2.status_code, r2.text)
