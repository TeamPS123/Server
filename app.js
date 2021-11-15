// connect firebase
var FCM = require('fcm-node')
const { networkInterfaces } = require('os')
var serviceAccount = require("./firebase.json")
var fcm = new FCM(serviceAccount)   

//user || device || status || id
var userList = []
//ender || receiver || body || title 
var messageList = []

//config socket.io
require('dotenv').config()
const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const PORT = process.env.PORT || 3030

//delete message received
Array.prototype.unfilter = (callback) => {
    let s = []
    for(let i = 0 ; i < this.length ;  i++){
        if(!callback(this[i])){
            s.push(this[i])
        }
    }

    return s
}

io.sockets.on("connection", (socket) => {
    console.log("user connect");

    //client login || data: user, device
    socket.on('login', (data) => {
        var info = JSON.parse(data)

        //check user exist
        if(userList.some((e) => {return e.user === info.user && e.device === info.device})){
            //find user of userList
            var user = userList.find((e) => e.user === info.user && e.device === info.device)
            //find index of user
            var index = userList.indexOf(user)
            //change status of user
            userList[index].status = true
            //change id of user
            userList[index].id = socket.id
        }else{
            //insert data new user
            userList.push({
                user: info.user,
                device: info.device,
                status: true,
                id: socket.id
            })
        }

        //check new notification 
        if(messageList.some((e) =>  e.receiver === info.user)){
            var new_notification = messageList.filter((e) => e.receiver === info.user)
            new_notification = new_notification.map((e) => ({sender: e.sender, title: e.title, body: e.body}))
            socket.emit("new_notification", {list: new_notification})
            check1("new_notification", new_notification)
            messageList = messageList.unfilter((e) =>  e.receiver === info.user)
        }

        check("login")

        //notification client succes
        socket.emit('noti_login', {
            message: "Thành công",
        })
    })

    //client disconnect
    socket.on("disconnect", ()=>{
        //check user login
        if(userList.some((e) => {return e.id === socket.id})){
            //find user of userList
            var user = userList.find((e) => e.id === socket.id)
            //find index of user
            var index = userList.indexOf(user)
            //change status of user
            userList[index].status = false
        }

        check("disconnect")
    })    

    //send notification || data: sender, receiver, title, body
    socket.on("notification", (data) => {
        send(data)
    })  

    //client signout
    socket.on("signout", () =>{
        let index = userList.indexOf(socket.id)
        userList.splice(index, 1);

        check("signout")
    })

    //send chat || data: sender, receiver, title, body
    socket.on("chat", (data) => {
        send(data)
    })

    //send message to user receiver
    function send(data){
        var info = JSON.parse(data)

        //check send message to user receiver
        var isSend = true
    
        //user receiver exist
        if(userList.some((element) => {return element.user === info.receiver})){
            //filter data user receiver
            var user_receiver = userList.filter((element) => element.user === info.receiver)
    
            check1("user_receiver", user_receiver)
            //user receiver status is active
            if(user_receiver.some((element) => { return element.status === true})){
                var user_receiver_true = user_receiver.filter((element) => element.status === true)
    
                check1("user_receiver_true", user_receiver_true)
                //send user receiver is active
                for(const item of user_receiver_true){
                    socket.to(item.id).emit("send_notication", {sender: info.sender, body: info.body, title: info.title})
                }
            }else{
                //send user receiver with all device
                for(const value of user_receiver){
                    //create message
                    var message = {
                        to: value.device,
                        notification: {
                            title: info.title,
                            body: info.body
                        }
                    }
    
                    //send firebase
                    fcm.send(message, function(err, response){
                        if (err) {            
                            console.log("Something has gone wrong!")
                            
                            isSend = false
                        } else {            
                            console.log("Successfully sent with response: ", response)     
                            
                            if(response.failureCount >= 1){
                                isSend = false
                            }else{
                                isSend = true
                            }
                        } 
                    })
                }
            }
        }else{
            isSend = false
        }

        if(!isSend){
            //insert data new noti
            messageList.push({
                sender: info.sender,
                receiver: info.receiver,
                body: info.body,
                title: info.title
            })  
        }
    
        check_log_messageList()
    }
})

function check(tag){
    console.log("--------------------------------------"+tag+"--------------------------------------")
    console.log(userList)
}

function check_log_messageList(){
    console.log("--------------------------------------"+"messageList"+"--------------------------------------")
    console.log(messageList)
}

function check1(tag, data){
    console.log("--------------------------------------"+tag+"--------------------------------------")
    console.log(data)
}

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));