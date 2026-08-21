《归档故乡》剧情数据库与JSON Schema规范

一、设计原则  
剧情、角色、物件、地图全部数据化。

二、目录结构  
/story  
 chapter01.json  
 chapter02.json

/characters  
 characters.json

/items  
 objects.json

/maps  
 maps.json

三、剧情节点结构  
{  
 id: 节点ID,  
 speaker: 角色,  
 text: 文本,  
 choices: 选择列表,  
 flags: 状态变化  
}

四、世界状态  
包含：  
\- 当前章节  
\- 已发现档案  
\- 人物关系  
\- 玩家选择  
\- 结局状态

五、开发要求  
所有内容可由工具生成、校验和热更新。  
