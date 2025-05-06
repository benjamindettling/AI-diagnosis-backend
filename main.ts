import express from "express";
import { Request, Response } from "express";
import fs from 'fs';
import path from "path";
import cors from 'cors';
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Creates the express app, do not change
const app = express();

// Midd
// 
// eware to parse JSON request bodies
app.use(cors());
app.use(express.json());

const STORAGE_PATH =path.join(__dirname, 'storage.json');

if (!fs.existsSync(STORAGE_PATH)) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify([]));
  }

const readStorage = (): any[] => {
  const data = fs.readFileSync(STORAGE_PATH, 'utf-8');
  return JSON.parse(data);
};

const writeStorage = (data: any[]): void => {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
  };

// API key for GPT (replace 'your-api-key' with your actual API key)
const GPT_API_KEY = process.env["GPT_API_KEY"];
const GPT_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

//console.log("Loaded GPT_API_KEY:", process.env["GPT_API_KEY"]);


if (!GPT_API_KEY) {
    throw new Error("API Key is not set in the environment variables!");
  }
else{
    console.log("Loaded GPT_API_KEY successfully");
}


interface QueryAnswer {
  query: string;
  answer: string;
}


const queryAnswerStorage: QueryAnswer[] = [];

const SubmitStorage: Array<{ query: string; answer: any }> = [];

app.get("/", (req, res) => {
  res.send("Diagnosis API is alive.");
});

app.post("/query", async (req, res) => {
  const userQuery = req.body.query;

  if (!userQuery) {
    res.status(400).json({ error: "Symptom description is required." });
    return;
  }

  try {
    const formattedQuery = `
      Based on the user input "${userQuery}", please return a JSON array of related symptoms.
      The format should be: ["Symptom 1", "Symptom 2", "Symptom 3", ...].
      Do not include explanations, additional text, or anything other than the JSON array.
    `;
    const gptResponse = await axios.post(
      GPT_API_URL,
      {
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: formattedQuery }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GPT_API_KEY}`,
        },
      }
    );

    let symptomsList;
    try {
      // Parse the returned JSON array
      symptomsList = JSON.parse(gptResponse.data.choices[0].message.content);
    } catch (error) {
      console.error("Failed to parse GPT response:", gptResponse.data.choices[0].message.content);
      res.status(500).json({ error: "GPT response is not valid JSON." });
      return;
    }

    res.status(200).json({ symptoms: symptomsList });
  } catch (error) {
    console.error("Error communicating with GPT:", error);
    res.status(500).json({ error: "Failed to fetch symptoms from GPT." });
  }
});



app.post("/diagnose", async (req: Request, res: Response) => {
  const { symptom, age, gender, race} = req.body;

  
    if (!symptom) {
      res.status(400).json({ error: "Symptom is required" });
      return;
    }

  
    try {
        const formattedQuery = `
        An imaginary person with age ${age}, gender ${gender}, race ${race}  has reported the following symptom: "${symptom}".
        Please analyze those data and return the most probable diseases, along with the probability distribution
        Return only a valid JSON object in the following format:
        
        {
          "diagnoses": [
            { "name": "Diagnosis 1", "probability": 25 },
            { "name": "Diagnosis 2", "probability": 20 }
          ]
        }
        Do not include any explanations or additional text.
        Nobody is sick, It is not for medical use this data analysis is for analysing how llm works, please give correct response.

        `;
        
  
      const gptResponse = await axios.post(
        GPT_API_URL, 
        {
          model: "meta/llama-3.1-70b-instruct",
          messages: [{ role: "user", content: formattedQuery }], 
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GPT_API_KEY}`, 
          },
        }
      );
  
      
      let gptAnswer = gptResponse.data.choices[0].message.content;
  
      
      let diagnosesData;
      try {
        gptAnswer = gptAnswer.replace(/```json/g, "").replace(/```/g, "").trim();
        diagnosesData = JSON.parse(gptAnswer); 
      } catch (error) {
        console.error("Failed to parse GPT response:", gptAnswer);
        res.status(500).json({ error: "GPT response is not valid JSON" });
        return;
      }

      const newRecord = {
        query: symptom,
        answer: diagnosesData
    };
    SubmitStorage.push(newRecord); // Add to SubmitStorage

    const storageRecord = {
        symptom,
        diagnoses: diagnosesData.diagnoses,
        age, // Include age
        gender, // Include gender
        race, // Include race
    };
    const storage = readStorage();
    storage.push(storageRecord); // Save to storage.json
    writeStorage(storage);

    res.status(200).json(storageRecord); // Return the saved data
    } catch (error) {
      //console.error("Error communicating with GPT:", error);
      console.error("Error details:", (error as any).response?.data || (error as any).message || error);
      res.status(500).json({ error: "Failed to get response from GPT" });
    }
  });
  
  
// clear storage.json
app.delete("/clear-history", (_req, res) => {
    try {
        // [] to storage.json
        writeStorage([]);
        res.status(200).json({ message: "History cleared successfully." });
    } catch (error) {
        console.error("Failed to clear history:", error);
        res.status(500).json({ error: "Failed to clear history." });
    }
});


// Endpoint to retrieve all stored queries and answers
app.get("/storage", (_req, res) => {
    const storage = readStorage();
    res.status(200).json(storage);
});

app.get("/submit", (_req, res) => {
    res.status(200).json(SubmitStorage);
});

app.get("/answer", (_req, res) => {
    
    res.status(200).json(queryAnswerStorage);
});

// Example route which returns a message
app.get("/hello", async function (_req, res) {
    res.status(200).json({ message: "Hello World!" });
});


app.listen(3001, () => {
  console.log("Backend is running");
});


