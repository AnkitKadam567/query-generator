const { response } = require("express");
const express = require("express");
require("dotenv").config();

const { Configuration, OpenAIApi } = require("openai");

const app = express();

app.use(express.json());

const config = new Configuration({
  apiKey: process.env.OPEN_AI_KEY,
});

const openai = new OpenAIApi(config);

app.post("/:dbName/generate", async (req, res) => {
  try {
    const dbName = req.params.dbName;
    const desc = req.body.queryDesc;
    const prompt = `generate ${dbName} query as per following description :\n ${desc}`;
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: `${prompt}`,
      temperature: 0,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });
    res.status(200).send({
      amswer: response.data.choices[0].text,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log("Server started on port " + port));
