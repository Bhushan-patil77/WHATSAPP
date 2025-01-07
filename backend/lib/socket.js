import {Server} from 'socket.io'
import express from 'express'
import http from 'http'
import User from '../models/userModel.js' 
import Message from '../models/messageModel.js'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors:[process.env.FRONTEND_URL]
}) 

const onlineUsersMap = {}
const undeliveredMsgsQueue = {}; 
const deliveryReportQueue = {}
const seenReportQueue = {}

export function getReceiverSocketId(_id){
    return onlineUsersMap[_id]
}

const bulkUpdateDeliveryInDatabase = async (messages) => {

  const updateOperations = messages.map(message => {
    return { updateOne: { filter: { _id: message._id }, update: { $set: { delivered: true } } } };
  });

  try {
    await Message.bulkWrite(updateOperations);
    console.log('Messages updated successfully');
  } catch (err) {
    console.error('Error during bulk update:', err);
  }
};  

io.on('connection', async (socket)=>{
 
    const {_id} = socket.handshake.query

    if(_id){onlineUsersMap[_id]=socket.id}

    io.emit('getOnlineUsers', {onlineUsers:Object.keys(onlineUsersMap), connectedUserId:_id})

    const updated = await User.findOneAndUpdate (
        {_id:_id},
        {$set:{lastSeen: 'online'}},
        {new:true}  
    )  

   

    if (undeliveredMsgsQueue[_id]) {
        undeliveredMsgsQueue[_id].forEach((message) => {
          console.log(message)
          socket.emit('getUndeliveredMsgs', message);  

        });


        if(onlineUsersMap[undeliveredMsgsQueue[_id][0].senderId.toString()])
        {
          const senderSocketId = onlineUsersMap[undeliveredMsgsQueue[_id][0].senderId.toString()]

          undeliveredMsgsQueue[_id].forEach((message) => {
            socket.to(senderSocketId).emit('deliveryReport', message); 
          });
          
        }
        else
        {
          bulkUpdateDeliveryInDatabase(undeliveredMsgsQueue[_id])
        }
         
        delete undeliveredMsgsQueue[_id];

    }



    socket.on('disconnect', async()=>{
    delete onlineUsersMap[_id]
    
    io.emit('getOnlineUsers', {onlineUsers:Object.keys(onlineUsersMap), disconnectedUserId:_id})
    
    const updated = await User.findOneAndUpdate (
        {_id:_id},
        {$set:{lastSeen: new Date().toLocaleTimeString()}},
        {new:true}
    )

    })


    socket.on('typing', (selectedUserId)=>{

        const {_id} = socket.handshake.query
        socket.to(onlineUsersMap[selectedUserId]).emit('typing', _id)

    })

    socket.on('notTyping', (selectedUserId)=>{

        const {_id} = socket.handshake.query
        socket.to(onlineUsersMap[selectedUserId]).emit('notTyping', _id)

    }) 

    socket.on('delivered', async (deliveredMessage) => { 
      socket.to(onlineUsersMap[deliveredMessage.senderId]).emit('deliveryReport', {...deliveredMessage, delivered:true})
        try {
          const updatedMessage = await Message.findOneAndUpdate(
            { _id: deliveredMessage._id },
            { $set: { delivered: true } },
            { new: true } 
          );  

          console.log('updated msg is ',updatedMessage)
           
          if(updatedMessage?._id) 
          {
            // socket.to(onlineUsersMap[updatedMessage.senderId]).emit('deliveryReport', updatedMessage)
          }

        } catch (error) {
          console.error('Error updating message:', error);
        }
      }); 
 
    socket.on('deliveredAndSeen', async(deliveredAndSeenMessage)=>{

      socket.to(onlineUsersMap[deliveredAndSeenMessage.senderId]).emit('seenReport', deliveredAndSeenMessage.messageId)
        try {

          const updatedMessage = await Message.findByIdAndUpdate(
            { _id: deliveredAndSeenMessage._id },
            { $set: { delivered:true, seen: true } },
            { new: true } 
             
          );


          if(updatedMessage?._id)
            {
              // socket.to(onlineUsersMap[updatedMessage.senderId]).emit('seenReport', updatedMessage)
            }

        } catch (error) {
          console.error('Error updating message:', error);
        }
    }) 
  
    socket.on('seen', async ({seenReportToId, messageId})=>{ 
      console.log('seen msg id is', messageId)
      if(onlineUsersMap[seenReportToId])
      {
        socket.to(onlineUsersMap[seenReportToId]).emit('seen', messageId)
      }
        await Message.findByIdAndUpdate(
          {_id:messageId},
          {$set:{delivered:true, seen:true}}
        )
    })

    socket.on('profileUpdate', (updatedUser)=>{

      updatedUser.recentChats.map((recentChat)=>{
        socket.to(onlineUsersMap[recentChat._id]).emit('profileUpdate', updatedUser)
      })
    })
 
   
})



export {io, server, app, undeliveredMsgsQueue}



