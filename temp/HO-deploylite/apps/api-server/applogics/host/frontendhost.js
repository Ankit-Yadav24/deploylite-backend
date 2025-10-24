import { RunTaskCommand } from "@aws-sdk/client-ecs";
import client from "../../client/client.js";
const frontendHost = async (req, res) => {
  const config = {
    cluster: process.env.cluster,
    task: process.env.task3,
  };
  //getting the giturl and projectid
  const { giturl, projectid, techused } = req.body;

  console.log("config is", config);
  console.log("all env's are", process.env.accesskeyid,"secret is", process.env.accesskeysecret,"region is", process.env.region);
  const cmd = new RunTaskCommand({
    cluster: config.cluster,
    taskDefinition: config.task,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: ["subnet-00a4a1974e1475145","subnet-06cb98fe49a3146b1","subnet-0379dfa5edb2e396e"],
        securityGroups: ["sg-07cf7978f8cd46a56"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: process.env.taskfrontendname,
          environment: [
            {
              name: "GIT_URL",
              value: giturl,
            },
            {
              name: "projectid",
              value: projectid,
            },
            {
              name: "techused",
              value: techused,
            },
            {
              name: "region",
              value: process.env.region,
            },
            {
              name: "accesskeyid",
              value: process.env.accesskeyid,
            },
            {
              name: "accesskeysecret",
              value: process.env.accesskeysecret,
            },
            {
              name: "bucket",
              value: "deploylite-status-code-bucket",
            },
          ],
        },
      ],
    },
  });
  try {
    const data = await client.send(cmd);
    console.log(data);
    return res.status(200).json({
      success: true,
      data: data,
      message: "Deployment started"
    })
  } catch (err) {
    console.log(err);
    res.status(500).send("Something went wrong");
  }
};
export { frontendHost };
