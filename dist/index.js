"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = express_1.default();
app.set('port', (process.env.PORT || 3000));
app.use(express_1.default.static(__dirname + '/public'));
app.get('/', function (req, res) {
    res.send('Hello World!');
});
app.listen(app.get('port'), function () {
    console.log("Node app is running at localhost:" + app.get('port'));
});
