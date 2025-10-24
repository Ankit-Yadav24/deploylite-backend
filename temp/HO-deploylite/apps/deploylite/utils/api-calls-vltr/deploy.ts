const DeployOnVultr = async(container:string)=>{
try{
const response = await fetch('/api/vultr/deploy', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
"containerName":container,
"tags":"deploylite-container"
})
});
const data = await response.json();
return {success:true,data}
}
catch(error){
  console.log(error)
  return {success:false,message:"A Major error occured"}
}
}

export default DeployOnVultr;