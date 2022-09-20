from flask import Flask, request, jsonify, make_response
from flask_restplus import Api, Resource, fields
from sheep_env import SheepEnv


flask_app = Flask(__name__)
app = Api(app=flask_app, version="0.0.1", title="DI-sheep App", description="Play Sheep with Deep Reinforcement Learning, Powered by OpenDILab")
name_space = app.namespace('DI-sheep', description='DI-sheep APIs')
model = app.model(
    'DI-sheep params', {
        'command': fields.String(required=False, description="Command Field", help="reset, step"),
        'argument': fields.Integer(required=False, description="Argument Field", help="reset->level, step->action"),
    }
)
env = SheepEnv(1)


@name_space.route("/")
class MainClass(Resource):

    def options(self):
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response

    @app.expect(model)
    def post(self):
        try:
            data = request.json
            cmd, arg = data['command'], data['argument']
            if cmd == 'reset':
                obs = env.reset(arg)
                done = False
            elif cmd == 'step':
                obs, _, done, _ = env.step(arg)
            else:
                return jsonify({
                    "statusCode": 500,
                    "status": "Invalid command: {}".format(cmd),
                })
            response = jsonify({"statusCode": 200, "status": "Execution action", "result": {"obs": obs, "done": done}})
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        except Exception:
            return jsonify({
                "statusCode": 500,
                "status": "Could not execute action",
            })
