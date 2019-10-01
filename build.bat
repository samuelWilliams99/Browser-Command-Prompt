docker stop BCP 
docker build -t browser-command-prompt . && docker run -d --rm -p 5000:5000 --name BCP browser-command-prompt
pause