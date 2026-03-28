/**
 * 数据管理模块
 * 优化帖子和评论的存储结构
 */

/**
 * 数据管理类
 */
class DataManager {
  /**
   * 构造函数
   */
  constructor() {
    this.posts = [];
    this.analysisStatus = {
      isRunning: false,
      currentPost: 0,
      totalPosts: 0,
      progress: 0
    };
  }
  
  /**
   * 添加帖子
   * @param {Array} newPosts - 新帖子列表
   */
  addPosts(newPosts) {
    if (Array.isArray(newPosts)) {
      newPosts.forEach(post => {
        // 检查帖子是否已存在
        const existingPost = this.posts.find(p => p.id === post.id);
        if (!existingPost) {
          this.posts.push(post);
        }
      });
    }
  }
  
  /**
   * 获取所有帖子
   * @returns {Array} - 帖子列表
   */
  getAllPosts() {
    return this.posts;
  }
  
  /**
   * 获取未分析的帖子
   * @returns {Array} - 未分析的帖子列表
   */
  getUnanalyzedPosts() {
    return this.posts.filter(post => !post.analyzed);
  }
  
  /**
   * 标记帖子为已分析
   * @param {string} postId - 帖子ID
   * @param {Object} analysisResult - 分析结果
   */
  markPostAsAnalyzed(postId, analysisResult) {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.analyzed = true;
      post.analysisResult = analysisResult;
    }
  }
  
  /**
   * 更新帖子
   * @param {Object} updatedPost - 更新后的帖子对象
   */
  updatePost(updatedPost) {
    const index = this.posts.findIndex(p => p.id === updatedPost.id);
    if (index !== -1) {
      this.posts[index] = { ...this.posts[index], ...updatedPost };
    }
  }
  
  /**
   * 获取单个帖子
   * @param {string} postId - 帖子ID
   * @returns {Object|null} 帖子对象
   */
  getPost(postId) {
    return this.posts.find(p => p.id === postId) || null;
  }
  
  /**
   * 清空帖子
   */
  clearPosts() {
    this.posts = [];
  }
  
  /**
   * 保存帖子到本地存储
   */
  savePosts() {
    // 按板块分组保存帖子
    const postsBySubreddit = {};
    this.posts.forEach(post => {
      if (!postsBySubreddit[post.subreddit]) {
        postsBySubreddit[post.subreddit] = [];
      }
      postsBySubreddit[post.subreddit].push(post);
    });
    
    // 保存每个板块的帖子
    Object.entries(postsBySubreddit).forEach(([subreddit, posts]) => {
      const dataWithTimestamp = {
        data: posts,
        timestamp: Date.now()
      };
      chrome.storage.local.set({ [`crawlResults_${subreddit}`]: dataWithTimestamp });
    });
    
    // 更新板块列表
    const subreddits = Object.keys(postsBySubreddit);
    chrome.storage.local.set({ 'crawlResults_subreddits': subreddits });
  }
  
  /**
   * 从本地存储加载帖子
   */
  loadPosts() {
    return new Promise((resolve) => {
      // 首先获取板块列表
      chrome.storage.local.get('crawlResults_subreddits', (subredditsResult) => {
        const subreddits = subredditsResult.crawlResults_subreddits || [];
        
        if (subreddits.length === 0) {
          this.posts = [];
          resolve(this.posts);
          return;
        }
        
        // 然后获取每个板块的帖子
        const getPromises = subreddits.map(subreddit => {
          return new Promise((resolvePost) => {
            chrome.storage.local.get(`crawlResults_${subreddit}`, (result) => {
              if (result[`crawlResults_${subreddit}`] && result[`crawlResults_${subreddit}`].data) {
                resolvePost(result[`crawlResults_${subreddit}`].data);
              } else {
                resolvePost([]);
              }
            });
          });
        });
        
        Promise.all(getPromises).then(postsArrays => {
          // 合并所有板块的帖子
          this.posts = [].concat(...postsArrays);
          resolve(this.posts);
        });
      });
    });
  }
}

/**
 * 评论树结构类
 */
class CommentTree {
  /**
   * 构造函数
   * @param {Array} comments - 评论列表
   */
  constructor(comments) {
    this.comments = comments;
  }
  
  /**
   * 获取评论树
   * @returns {Array} - 评论树
   */
  getTree() {
    return this.buildTree(this.comments);
  }
  
  /**
   * 构建评论树
   * @param {Array} comments - 评论列表
   * @returns {Array} - 评论树
   */
  buildTree(comments) {
    const tree = [];
    const commentMap = new Map();
    
    // 首先创建所有评论的映射
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, children: [] });
    });
    
    // 构建树结构
    comments.forEach(comment => {
      const parentId = this.getParentId(comment.id);
      if (parentId) {
        const parent = commentMap.get(parentId);
        if (parent) {
          parent.children.push(commentMap.get(comment.id));
        } else {
          tree.push(commentMap.get(comment.id));
        }
      } else {
        tree.push(commentMap.get(comment.id));
      }
    });
    
    return tree;
  }
  
  /**
   * 获取父评论ID
   * @param {string} commentId - 评论ID
   * @returns {string|null} - 父评论ID
   */
  getParentId(commentId) {
    // 这里需要根据实际的评论ID格式来实现
    // 假设评论ID格式为 "t1_abc123"
    return null;
  }
}

// 导出模块
const dataManagerInstance = new DataManager();
globalThis.dataManager = dataManagerInstance;
globalThis.CommentTree = CommentTree;
globalThis.getAnalysisStatus = () => dataManagerInstance.analysisStatus;
globalThis.setAnalysisStatus = (status) => {
  dataManagerInstance.analysisStatus = { ...dataManagerInstance.analysisStatus, ...status };
};
