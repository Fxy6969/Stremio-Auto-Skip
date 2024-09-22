from flask import Flask
import json

data = json.load(open('data.json'))

app = Flask(__name__)

@app.route('/<name>', methods=['GET'])
def name(name):
    if name in data:
        return data[name]


@app.route('/<name>/<start_intro>/<end_intro>')
def update_intro(name, start_intro, end_intro):
    if name in data:
        with open('data.json', 'w') as f:
            data[name] = {"start_intro": start_intro, "end_intro": end_intro}
            json.dump(data, f)
        return "Updated"
