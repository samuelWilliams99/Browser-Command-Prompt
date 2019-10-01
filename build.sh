sudo docker stop BCP 
sudo docker build -t browser-command-prompt . && sudo docker run -d --rm -p 5000:5000 --name BCP browser-command-prompt