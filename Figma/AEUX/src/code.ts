figma.showUI(__html__, { width: 166, height: 160 });
let hasFrameData;
let frameArr = []
let imageHashList = []
let imageBytesList = []

// receive message from the UI
figma.ui.onmessage = message => {
	if (message.type === 'getSelection') {
        hasFrameData = false;
        frameArr = []
        imageHashList = []
        imageBytesList = []

        if (figma.currentPage.selection.length < 1) { return }      // nothing selected
                
        let selection = nodeToObj(figma.currentPage.selection);        

        if (frameArr[0].children.length < 1) {
            frameArr[0].children = selection;
        }

        // send message to UI
        if (imageHashList.length > 0) {            
            storeImageData( Array.from(new Set(imageHashList)), frameArr )
        } else {
            figma.ui.postMessage({type: 'exportJson', data: frameArr});
        }
        
  }
  
  if (message.type === 'flattenLayers') {
    if (figma.currentPage.selection.length < 1) { return }      // nothing selected

    // let selection = nodeToObj(figma.currentPage.selection)
    let layerCount = flattenRecursive(figma.currentPage.selection, 0)

    // reselect layers
    figma.currentPage.selection = figma.currentPage.selection

    figma.ui.postMessage({type: 'footerMsg', action: 'flattened', layerCount});
  }

	//Communicate back to the UI
	// console.log('send message back to ui');
}

function nodeToObj (nodes) {
  console.log('nodes', nodes);
  console.log(nodes.length);
  
  if (nodes.length < 1) { return [] }

  
    console.log(nodes[0].type);
    let arr = [];

    if (nodes[0] && (nodes[0].type === 'FRAME' || nodes[0].type === 'COMPONENT')) {            // a frame is directly selected
      console.log('GOT A FRAME');
      // console.log(nodes[0].children);
      hasFrameData = true     // dont need to get the frame data
      frameArr.push( getElement(nodes[0], false) );
      nodes = nodes[0].children
      
      // frameArr.push( nodeToObj(nodes[0].children) )
      // return [];
    }
    // } else {                                    // shapes are selected
        // get shapes
    nodes.forEach(node => {
      // get the frame data
      if (!hasFrameData) {
        console.log('get the frame data');
        let frame = findFrame(node);
        // console.log('frame:', frame);
        let frameData = getElement(frame, true);    // skip gathering children data
        frameData.children = [];                    // clear the children of the frame to push them later

        frameArr.push(frameData);
      }

      let obj = getElement(node, false)
      arr.push(obj);
    });
        // console.log('arr: ', arr);
    // }
    
    return arr;
    

    function findFrame(node) {
        // console.log('node.type', node.type);
        
        if (node.type !== 'FRAME' && node.type !== 'COMPONENT') {
            return findFrame(node.parent);
        } else {
            hasFrameData = true;
            return node;
        }
    }
    function getElement(node, skipChildren) {
        console.log('node', node);
        let obj = {};
		    for (const key in node) {
            let element = node[key];
            // console.log(element);
            
            if (key === 'children' && !skipChildren) { element = nodeToObj(element) }
            if (key === 'backgrounds') { element = nodeToObj(element) }
            if (key === 'fills' && element.length > 0) { collectImageHashes(element, node.id) }

            // corner radius
            if (element == figma.mixed && key === 'cornerRadius') {
                element = Math.min(node.topLeftRadius, node.topRightRadius, node.bottomLeftRadius, node.bottomRightRadius);
            } 

            // try to get the first value on the text
            if (element == figma.mixed) {
                let str = 'getRange' + key.replace(/^\w/, c => c.toUpperCase())
                try {
                    element = node[str](0,1)
                } catch (error) {
                    continue
                }
            } 

            // layer.fontName !== (figma.mixed)) ? layer.fontName.family : layer.getRangeFontName(0,1).family
            // if (key === 'parent') { console.log(element); }

            obj[key] = element;
        }
        
        return obj;
    }

    function collectImageHashes(element, id) {
        // console.log('imageHash', id, element);
        for (const i in element) {
            const fill = element[i];
            if (fill.type == 'IMAGE') {
                imageHashList.push({hash: fill.imageHash, id})
            }
        }
    }

}

async function storeImageData (imageHashList, layers) {
    // console.log(imageHashList);
    
    for (const i in imageHashList) {
        // console.log(element[i]);
        const hash = imageHashList[i].hash;
        const name = imageHashList[i].id.replace(/:/g, '-');

        let image = figma.getImageByHash(hash)
        let bytes = await image.getBytesAsync()

        imageBytesList.push({name, bytes})
        console.log(bytes);
    }
    
    figma.ui.postMessage({type: 'exportJsonAndImages', images: imageBytesList, data: layers});
    
}

function flattenRecursive(selection, layerCount) {
  selection.forEach(shape => {
      if (shape.children) {
        layerCount = flattenRecursive(shape.children, layerCount)
      } else {
        let t = shape.relativeTransform;
        /// check for transforms
        if (t[0][0].toFixed(6) != 1 || t[0][1].toFixed(6) != 0 || t[1][0].toFixed(6) != 0 || t[1][1].toFixed(6) != 1) {
          figma.flatten( [shape] )
          layerCount ++
        }
      }
  });
  return layerCount
}