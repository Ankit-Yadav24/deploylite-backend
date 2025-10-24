import { RunTaskCommand } from "@aws-sdk/client-ecs";
import client from "../../client/client.js";
const Chatbot= async (req, res) => {
  //task config
  const config = {
    cluster: process.env.cluster,
    task: process.env.task11,
  };
  //getting the giturl and projectid
  const {  projectid,env } = req.body;


  const cmd = new RunTaskCommand({
    cluster: config.cluster,
    taskDefinition: config.task,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: ["subnet-00a4a1974e1475145","subnet-06cb98fe49a3146b1","subnet-0379dfa5edb2e396e"],
        securityGroups:["sg-07cf7978f8cd46a56"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: process.env.taskchatbotname,
          environment: [
            {
              name: "GIT_URL",
              value: "https://github.com/BasirKhan418/chatbot-builder.git",
            },
            {
              name: "projectid",
              value: projectid,
            },
            {
              name: "env",
              value: env || "",
            },
          ],
        },
      ],
    },
  });
  try {
    const data = await client.send(cmd);
    console.log(data);
    return res.send({ success: true, message: "Hosting started successfully", data: data });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ success: false, message: "Error starting hosting", error: err.message });
  }
};
export { Chatbot };
