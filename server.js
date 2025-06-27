// server.js - Main Express Server
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');
const clustering = require('ml-kmeans');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================
// 1. DATA SOURCES & DISCOVERY ENGINE
// ================================

class DataSourceManager {
  constructor() {
    this.searchEngineAPIs = {
      google: process.env.GOOGLE_API_KEY,
      bing: process.env.BING_API_KEY,
      yandex: process.env.YANDEX_API_KEY
    };
    
    this.clickstreamSources = [
      'similarweb_api', 'jumpshot_data', 'internal_browser_data'
    ];
  }

  // Simulate web crawling for keyword discovery
  async crawlCompetitorSites(domain) {
    try {
      const response = await axios.get(`https://${domain}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 SEO Research Bot' }
      });
      
      const $ = cheerio.load(response.data);
      const keywords = [];
      
      // Extract meta keywords, title, headings
      const title = $('title').text();
      const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
      const headings = [];
      
      $('h1, h2, h3').each((i, el) => {
        headings.push($(el).text().trim());
      });
      
      // Process text content for keyword extraction
      const bodyText = $('body').text();
      const extractedKeywords = this.extractKeywordsFromText(bodyText);
      
      return {
        domain,
        title_keywords: this.tokenizeAndClean(title),
        meta_keywords: metaKeywords.split(',').map(k => k.trim()),
        heading_keywords: headings.flatMap(h => this.tokenizeAndClean(h)),
        content_keywords: extractedKeywords,
        crawl_date: new Date()
      };
    } catch (error) {
      console.error(`Crawl failed for ${domain}:`, error.message);
      return null;
    }
  }

  // Simulate search engine suggestion API calls
  async getSearchSuggestions(keyword) {
    // Simulate Google Suggest API
    const suggestions = [];
    const prefixes = ['how to', 'what is', 'best', 'vs', 'for', 'with'];
    const suffixes = ['2024', 'guide', 'tips', 'free', 'online', 'near me'];
    
    prefixes.forEach(prefix => {
      suggestions.push(`${prefix} ${keyword}`);
    });
    
    suffixes.forEach(suffix => {
      suggestions.push(`${keyword} ${suffix}`);
    });
    
    return suggestions;
  }

  // Extract keywords using NLP
  extractKeywordsFromText(text) {
    const tokens = natural.WordTokenizer().tokenize(text.toLowerCase());
    const stopWords = natural.stopwords;
    
    // Remove stop words and short tokens
    const filteredTokens = tokens.filter(token => 
      !stopWords.includes(token) && 
      token.length > 2 && 
      /^[a-zA-Z]+$/.test(token)
    );
    
    // Calculate TF-IDF scores (simplified)
    const tokenFreq = {};
    filteredTokens.forEach(token => {
      tokenFreq[token] = (tokenFreq[token] || 0) + 1;
    });
    
    // Return top keywords by frequency
    return Object.entries(tokenFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([word, freq]) => ({ word, frequency: freq }));
  }

  tokenizeAndClean(text) {
    return natural.WordTokenizer()
      .tokenize(text.toLowerCase())
      .filter(token => token.length > 2 && /^[a-zA-Z]+$/.test(token));
  }
}

// ================================
// 2. KEYWORD METRICS CALCULATION
// ================================

class KeywordMetricsCalculator {
  constructor() {
    this.searchVolumeData = new Map(); // Simulated search volume database
    this.competitorData = new Map();   // SERP competitor analysis
    this.cpcData = new Map();          // Cost per click data
  }

  // Calculate search volume with regional breakdown
  calculateSearchVolume(keyword) {
    // Simulate search volume calculation based on multiple data sources
    const baseVolume = this.getHistoricalSearchData(keyword);
    const seasonalityFactor = this.getSeasonalityMultiplier(keyword);
    const trendFactor = this.getTrendMultiplier(keyword);
    
    const monthlyVolume = Math.round(baseVolume * seasonalityFactor * trendFactor);
    
    return {
      global_monthly: monthlyVolume,
      regional_breakdown: {
        'US': Math.round(monthlyVolume * 0.4),
        'UK': Math.round(monthlyVolume * 0.15),
        'CA': Math.round(monthlyVolume * 0.1),
        'AU': Math.round(monthlyVolume * 0.08),
        'other': Math.round(monthlyVolume * 0.27)
      },
      historical_data: this.generateHistoricalVolume(keyword, 12),
      confidence_score: this.calculateVolumeConfidence(keyword)
    };
  }

  // Calculate Keyword Difficulty (KD) Score
  calculateKeywordDifficulty(keyword, serpResults) {
    let difficultyScore = 0;
    const factors = {};
    
    // Analyze top 10 SERP results
    serpResults.slice(0, 10).forEach((result, position) => {
      const positionWeight = (11 - position) / 10;
      
      // Domain Authority factor (30% weight)
      const domainAuthority = this.getDomainAuthority(result.domain);
      factors.domain_authority = domainAuthority;
      difficultyScore += (domainAuthority / 100) * 30 * positionWeight;
      
      // Backlink Profile factor (25% weight)
      const backlinkStrength = this.getBacklinkStrength(result.url);
      factors.backlink_strength = backlinkStrength;
      difficultyScore += (backlinkStrength / 100) * 25 * positionWeight;
      
      // On-page SEO factor (20% weight)
      const onPageScore = this.analyzeOnPageSEO(result, keyword);
      factors.onpage_seo = onPageScore;
      difficultyScore += (onPageScore / 100) * 20 * positionWeight;
      
      // Content Quality factor (15% weight)
      const contentScore = this.analyzeContentQuality(result);
      factors.content_quality = contentScore;
      difficultyScore += (contentScore / 100) * 15 * positionWeight;
      
      // SERP Features impact (10% weight)
      const serpFeaturesImpact = this.analyzeSERPFeatures(serpResults);
      factors.serp_features = serpFeaturesImpact;
      difficultyScore += (serpFeaturesImpact / 100) * 10 * positionWeight;
    });
    
    return {
      difficulty_score: Math.min(100, Math.round(difficultyScore)),
      difficulty_level: this.getDifficultyLevel(difficultyScore),
      contributing_factors: factors,
      recommendation: this.getDifficultyRecommendation(difficultyScore)
    };
  }

  // Estimate Click-Through Rate
  estimateCTR(position, serpFeatures = []) {
    // Base CTR by position (Google organic results)
    const baseCTRs = {
      1: 28.5, 2: 15.7, 3: 11.0, 4: 8.0, 5: 6.2,
      6: 4.8, 7: 3.7, 8: 2.8, 9: 2.2, 10: 1.8
    };
    
    let ctr = baseCTRs[position] || 1.0;
    
    // Adjust for SERP features
    serpFeatures.forEach(feature => {
      switch(feature.type) {
        case 'featured_snippet':
          ctr *= (position === 1) ? 0.6 : 0.8; // Featured snippets reduce CTR
          break;
        case 'ads':
          ctr *= 0.7; // Ads reduce organic CTR
          break;
        case 'local_pack':
          ctr *= 0.75;
          break;
        case 'image_pack':
          ctr *= 0.9;
          break;
      }
    });
    
    return {
      estimated_ctr: Math.round(ctr * 100) / 100,
      factors_applied: serpFeatures.map(f => f.type),
      confidence_level: 'medium'
    };
  }

  // Calculate CPC and Paid Difficulty
  calculateCPCMetrics(keyword) {
    const competition = this.getAdCompetition(keyword);
    const commercialIntent = this.analyzeCommercialIntent(keyword);
    
    // Simulate CPC calculation based on competition and intent
    const baseCPC = competition * commercialIntent * Math.random() * 5;
    
    return {
      average_cpc: Math.round(baseCPC * 100) / 100,
      competition_level: this.getCompetitionLevel(competition),
      paid_difficulty: Math.round(competition * 100),
      commercial_intent: commercialIntent,
      suggested_bid_range: {
        low: Math.round(baseCPC * 0.7 * 100) / 100,
        high: Math.round(baseCPC * 1.3 * 100) / 100
      }
    };
  }

  // Helper methods for metric calculation
  getHistoricalSearchData(keyword) {
    // Simulate search volume based on keyword characteristics
    const length = keyword.length;
    const wordCount = keyword.split(' ').length;
    
    let baseVolume = 1000;
    if (wordCount === 1) baseVolume *= 5;
    if (length < 10) baseVolume *= 2;
    if (keyword.includes('how')) baseVolume *= 1.5;
    if (keyword.includes('best')) baseVolume *= 2;
    
    return Math.round(baseVolume * (0.5 + Math.random()));
  }

  getSeasonalityMultiplier(keyword) {
    const month = new Date().getMonth();
    // Simulate seasonal trends
    if (keyword.includes('christmas') && month === 11) return 3.0;
    if (keyword.includes('summer') && [5,6,7].includes(month)) return 2.0;
    if (keyword.includes('tax') && [2,3].includes(month)) return 1.8;
    return 1.0;
  }

  getTrendMultiplier(keyword) {
    // Simulate trend analysis
    if (keyword.includes('ai') || keyword.includes('artificial intelligence')) return 1.5;
    if (keyword.includes('blockchain') || keyword.includes('crypto')) return 0.8;
    return 1.0;
  }

  generateHistoricalVolume(keyword, months) {
    const data = [];
    const baseVolume = this.getHistoricalSearchData(keyword);
    
    for (let i = months; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const seasonality = this.getSeasonalityMultiplier(keyword);
      const randomVariation = 0.8 + (Math.random() * 0.4);
      
      data.push({
        month: date.toISOString().slice(0, 7),
        volume: Math.round(baseVolume * seasonality * randomVariation)
      });
    }
    
    return data;
  }

  calculateVolumeConfidence(keyword) {
    // Simulate confidence based on data sources availability
    let confidence = 0.7;
    if (keyword.split(' ').length === 1) confidence += 0.1;
    if (keyword.length > 20) confidence -= 0.2;
    return Math.min(0.95, Math.max(0.3, confidence));
  }

  getDomainAuthority(domain) {
    // Simulate domain authority calculation
    const domainFactors = {
      'wikipedia.org': 95, 'youtube.com': 98, 'amazon.com': 96,
      'google.com': 100, 'facebook.com': 96, 'reddit.com': 91
    };
    
    return domainFactors[domain] || (30 + Math.random() * 40);
  }

  getBacklinkStrength(url) {
    // Simulate backlink analysis
    return Math.round(20 + Math.random() * 60);
  }

  analyzeOnPageSEO(result, keyword) {
    // Simulate on-page SEO analysis
    let score = 50;
    
    if (result.title && result.title.toLowerCase().includes(keyword.toLowerCase())) {
      score += 20;
    }
    
    if (result.meta_description && result.meta_description.toLowerCase().includes(keyword.toLowerCase())) {
      score += 15;
    }
    
    if (result.url.toLowerCase().includes(keyword.toLowerCase().replace(/\s+/g, '-'))) {
      score += 15;
    }
    
    return Math.min(100, score);
  }

  analyzeContentQuality(result) {
    // Simulate content quality analysis
    const wordCount = result.content_length || 500;
    let score = 30;
    
    if (wordCount > 1000) score += 25;
    if (wordCount > 2000) score += 15;
    if (result.has_images) score += 10;
    if (result.has_videos) score += 10;
    if (result.reading_level === 'appropriate') score += 10;
    
    return Math.min(100, score);
  }

  analyzeSERPFeatures(serpResults) {
    // Count SERP features and calculate impact
    const features = serpResults.filter(r => r.type !== 'organic').length;
    return Math.min(100, features * 15);
  }

  getDifficultyLevel(score) {
    if (score < 30) return 'Easy';
    if (score < 50) return 'Medium';
    if (score < 70) return 'Hard';
    return 'Very Hard';
  }

  getDifficultyRecommendation(score) {
    if (score < 30) return 'Good opportunity for new websites';
    if (score < 50) return 'Achievable with quality content and basic SEO';
    if (score < 70) return 'Requires strong domain authority and comprehensive content';
    return 'Very competitive - consider long-tail alternatives';
  }

  getAdCompetition(keyword) {
    // Simulate ad competition analysis
    const commercialKeywords = ['buy', 'best', 'review', 'price', 'cheap', 'discount'];
    let competition = 0.3;
    
    commercialKeywords.forEach(word => {
      if (keyword.toLowerCase().includes(word)) {
        competition += 0.2;
      }
    });
    
    return Math.min(1.0, competition);
  }

  analyzeCommercialIntent(keyword) {
    const intentKeywords = {
      transactional: ['buy', 'purchase', 'order', 'shop', 'price', 'cost'],
      commercial: ['best', 'top', 'review', 'compare', 'vs'],
      informational: ['how', 'what', 'why', 'guide', 'tutorial'],
      navigational: ['login', 'website', 'official']
    };
    
    let intent = 'informational';
    let intentScore = 0.3;
    
    for (const [type, keywords] of Object.entries(intentKeywords)) {
      const matches = keywords.filter(word => keyword.toLowerCase().includes(word)).length;
      if (matches > 0) {
        intent = type;
        intentScore = type === 'transactional' ? 1.0 : 
                     type === 'commercial' ? 0.8 : 
                     type === 'navigational' ? 0.6 : 0.3;
        break;
      }
    }
    
    return intentScore;
  }

  getCompetitionLevel(competition) {
    if (competition < 0.3) return 'Low';
    if (competition < 0.6) return 'Medium';
    return 'High';
  }
}

// ================================
// 3. SERP ANALYSIS ENGINE
// ================================

class SERPAnalyzer {
  constructor() {
    this.serpFeatures = [
      'featured_snippet', 'people_also_ask', 'local_pack', 
      'image_pack', 'video_carousel', 'shopping_results',
      'news_results', 'knowledge_panel'
    ];
  }

  async analyzeSERP(keyword) {
    // Simulate SERP scraping and analysis
    const serpResults = await this.scrapeSERP(keyword);
    const analysis = {
      keyword,
      total_results: serpResults.length,
      organic_results: serpResults.filter(r => r.type === 'organic'),
      serp_features: this.identifySERPFeatures(serpResults),
      top_competitors: this.analyzeTopCompetitors(serpResults),
      content_analysis: this.analyzeContentPatterns(serpResults),
      ranking_factors: this.identifyRankingFactors(serpResults),
      opportunities: this.identifyOpportunities(serpResults)
    };
    
    return analysis;
  }

  async scrapeSERP(keyword) {
    // Simulate SERP results (in real implementation, this would scrape actual SERPs)
    const results = [];
    
    // Add organic results
    for (let i = 1; i <= 10; i++) {
      results.push({
        position: i,
        type: 'organic',
        title: `Result ${i} for ${keyword}`,
        url: `https://example${i}.com/page`,
        domain: `example${i}.com`,
        meta_description: `Description for result ${i} about ${keyword}`,
        content_length: 500 + Math.random() * 2000,
        has_images: Math.random() > 0.5,
        has_videos: Math.random() > 0.7,
        reading_level: 'appropriate',
        last_updated: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        social_signals: {
          facebook_shares: Math.round(Math.random() * 1000),
          twitter_shares: Math.round(Math.random() * 500),
          linkedin_shares: Math.round(Math.random() * 200)
        }
      });
    }
    
    // Add SERP features
    if (Math.random() > 0.6) {
      results.unshift({
        type: 'featured_snippet',
        title: `What is ${keyword}?`,
        url: 'https://example1.com/page',
        snippet: `A featured snippet about ${keyword}...`,
        format: 'paragraph'
      });
    }
    
    if (Math.random() > 0.7) {
      results.push({
        type: 'people_also_ask',
        questions: [
          `What is ${keyword}?`,
          `How does ${keyword} work?`,
          `Best ${keyword} tools`,
          `${keyword} vs alternatives`
        ]
      });
    }
    
    return results;
  }

  identifySERPFeatures(results) {
    const features = {};
    
    results.forEach(result => {
      if (result.type !== 'organic') {
        features[result.type] = features[result.type] || [];
        features[result.type].push(result);
      }
    });
    
    return {
      present_features: Object.keys(features),
      feature_details: features,
      serp_layout_complexity: this.calculateSERPComplexity(features)
    };
  }

  analyzeTopCompetitors(results) {
    const organicResults = results.filter(r => r.type === 'organic').slice(0, 5);
    
    return organicResults.map(result => ({
      position: result.position,
      domain: result.domain,
      url: result.url,
      domain_authority: this.getDomainAuthority(result.domain),
      estimated_traffic: this.estimateTraffic(result.position),
      content_metrics: {
        word_count: result.content_length,
        has_multimedia: result.has_images || result.has_videos,
        freshness_score: this.calculateContentFreshness(result.last_updated)
      },
      backlink_metrics: this.simulateBacklinkMetrics(result.url),
      technical_seo: this.analyzeTechnicalSEO(result)
    }));
  }

  analyzeContentPatterns(results) {
    const organicResults = results.filter(r => r.type === 'organic');
    
    const avgWordCount = organicResults.reduce((sum, r) => sum + r.content_length, 0) / organicResults.length;
    const multimediaUsage = organicResults.filter(r => r.has_images || r.has_videos).length / organicResults.length;
    
    return {
      average_word_count: Math.round(avgWordCount),
      multimedia_usage_rate: Math.round(multimediaUsage * 100),
      content_freshness: this.analyzeContentFreshness(organicResults),
      common_topics: this.extractCommonTopics(organicResults),
      content_gaps: this.identifyContentGaps(organicResults)
    };
  }

  identifyRankingFactors(results) {
    const organicResults = results.filter(r => r.type === 'organic');
    
    // Analyze correlation between ranking and various factors
    const factors = {
      domain_authority_correlation: this.calculateCorrelation(organicResults, 'domain_authority'),
      content_length_correlation: this.calculateCorrelation(organicResults, 'content_length'),
      social_signals_correlation: this.calculateSocialCorrelation(organicResults),
      freshness_correlation: this.calculateFreshnessCorrelation(organicResults)
    };
    
    return {
      primary_factors: Object.entries(factors)
        .filter(([, correlation]) => Math.abs(correlation) > 0.3)
        .map(([factor, correlation]) => ({ factor, strength: correlation })),
      recommendations: this.generateRankingRecommendations(factors)
    };
  }

  identifyOpportunities(results) {
    const opportunities = [];
    
    // Content gap opportunities
    const avgWordCount = results.filter(r => r.type === 'organic')
      .reduce((sum, r) => sum + r.content_length, 0) / 10;
    
    if (avgWordCount < 1000) {
      opportunities.push({
        type: 'content_length',
        description: 'Competitors have relatively short content - opportunity for comprehensive guide',
        recommendation: `Create content with 1500+ words`
      });
    }
    
    // SERP feature opportunities
    const hasVideo = results.some(r => r.has_videos);
    if (!hasVideo) {
      opportunities.push({
        type: 'video_content',
        description: 'No video content in top results',
        recommendation: 'Create video content to stand out'
      });
    }
    
    // Featured snippet opportunity
    const hasFeaturedSnippet = results.some(r => r.type === 'featured_snippet');
    if (!hasFeaturedSnippet) {
      opportunities.push({
        type: 'featured_snippet',
        description: 'No featured snippet present',
        recommendation: 'Structure content to target featured snippet'
      });
    }
    
    return opportunities;
  }

  // Helper methods
  calculateSERPComplexity(features) {
    return Object.keys(features).length * 10; // Simplified complexity score
  }

  getDomainAuthority(domain) {
    // Reuse from KeywordMetricsCalculator
    const calculator = new KeywordMetricsCalculator();
    return calculator.getDomainAuthority(domain);
  }

  estimateTraffic(position) {
    const ctrRates = { 1: 0.285, 2: 0.157, 3: 0.11, 4: 0.08, 5: 0.062 };
    const estimatedVolume = 1000; // Would use actual search volume
    return Math.round((ctrRates[position] || 0.02) * estimatedVolume);
  }

  calculateContentFreshness(lastUpdated) {
    const daysSince = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
    return Math.max(0, 100 - daysSince * 2); // Freshness score decreases over time
  }

  simulateBacklinkMetrics(url) {
    return {
      referring_domains: Math.round(Math.random() * 500),
      total_backlinks: Math.round(Math.random() * 5000),
      domain_rating: Math.round(30 + Math.random() * 50),
      url_rating: Math.round(20 + Math.random() * 60)
    };
  }

  analyzeTechnicalSEO(result) {
    return {
      page_speed_score: Math.round(50 + Math.random() * 50),
      mobile_friendly: Math.random() > 0.2,
      https_enabled: Math.random() > 0.1,
      structured_data: Math.random() > 0.4
    };
  }

  analyzeContentFreshness(results) {
    const scores = results.map(r => this.calculateContentFreshness(r.last_updated));
    return {
      average_freshness: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      freshest_content_age: Math.min(...scores),
      oldest_content_age: Math.max(...scores)
    };
  }

  extractCommonTopics(results) {
    // Simplified topic extraction
    const topics = ['guide', 'tutorial', 'tips', 'best practices', 'tools', 'comparison'];
    return topics.filter(() => Math.random() > 0.5);
  }

  identifyContentGaps(results) {
    return [
      'Step-by-step tutorials',
      'Video explanations',
      'Infographics',
      'Case studies',
      'Tool comparisons'
    ].filter(() => Math.random() > 0.6);
  }

  calculateCorrelation(results, factor) {
    return (Math.random() - 0.5) * 2; // Simplified correlation (-1 to 1)
  }

  calculateSocialCorrelation(results) {
    return (Math.random() - 0.5) * 2;
  }

  calculateFreshnessCorrelation(results) {
    return (Math.random() - 0.5) * 2;
  }

  generateRankingRecommendations(factors) {
    const recommendations = [];
    
    Object.entries(factors).forEach(([factor, correlation]) => {
      if (Math.abs(correlation) > 0.3) {
        recommendations.push(`Focus on ${factor.replace('_', ' ')} - strong correlation detected`);
      }
    });
    
    return recommendations.length ? recommendations : ['Focus on comprehensive content and user experience'];
  }
}

// ================================
// 4. KEYWORD GROUPING & CLUSTERING
// ================================

class KeywordClusteringEngine {
  constructor() {
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
  }

  clusterKeywords(keywords) {
    // Prepare keywords for clustering
    const keywordVectors = this.vectorizeKeywords(keywords);
    
    // Perform K-means clustering
    const numClusters = Math.min(Math.ceil(keywords.length / 5), 10);
    const clusters = this.performClustering(keywordVectors, numClusters);
    
    // Group keywords by clusters
    const groupedKeywords = this.groupKeywordsByClusters(keywords, clusters);
    
    // Identify parent topics
    const parentTopics = this.identifyParentTopics(groupedKeywords);
    
    // Extract question keywords
    const questionKeywords = this.extractQuestionKeywords(keywords);
    
    return {
      clusters: groupedKeywords,
      parent_topics: parentTopics,
      question_keywords: questionKeywords,
      cluster_stats: this.calculateClusterStats(groupedKeywords)
    };
  }

  vectorizeKeywords(keywords) {
    const allTokens = new Set();
    const keywordTokens = keywords.map(keyword => {
      const tokens = this.tokenizer.tokenize(keyword.toLowerCase())
        .map(token => this.stemmer.stem(token))
        .filter(token => token.length > 2);
      
      tokens.forEach(token => allTokens.add(token));
      return { keyword, tokens };
    });
    
    const vocabulary = Array.from(allTokens);
    
    // Create TF-IDF vectors
    const vectors = keywordTokens.map(({ keyword, tokens }) => {
      const vector = new Array(vocabulary.length).fill(0);
      
      tokens.forEach(token => {
        const index = vocabulary.indexOf(token);
        if (index !== -1) {
          vector[index] = this.calculateTFIDF(token, tokens, keywordTokens);
        }
      });
      
      return { keyword, vector };
    });
    
    return vectors;
  }

  calculateTFIDF(term, document, corpus) {
    // Term Frequency
    const tf = document.filter(token => token === term).length / document.length;
    
    // Inverse Document Frequency
    const docsWithTerm = corpus.filter(doc => doc.tokens.includes(term)).length;
    const idf = Math.log(corpus.length / docsWithTerm);
    
    return tf * idf;
  }
performClustering(vectors, numClusters) {
    // Simplified clustering algorithm
    const clusters = [];
    
    for (let i = 0; i < numClusters; i++) {
      clusters.push([]);
    }
    
    // Assign each keyword to the nearest cluster based on similarity
    vectors.forEach(({ keyword, vector }) => {
      let bestCluster = 0;
      let bestSimilarity = -1;
      
      for (let i = 0; i < numClusters; i++) {
        const similarity = this.calculateCosineSimilarity(vector, this.getClusterCentroid(clusters[i], vectors));
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = i;
        }
      }
      
      clusters[bestCluster].push(keyword);
    });
    
    return clusters.filter(cluster => cluster.length > 0);
  }

  calculateCosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getClusterCentroid(cluster, allVectors) {
    if (cluster.length === 0) return [];
    
    const clusterVectors = allVectors.filter(v => cluster.includes(v.keyword)).map(v => v.vector);
    if (clusterVectors.length === 0) return [];
    
    const centroid = new Array(clusterVectors[0].length).fill(0);
    
    clusterVectors.forEach(vector => {
      vector.forEach((value, index) => {
        centroid[index] += value;
      });
    });
    
    return centroid.map(value => value / clusterVectors.length);
  }

  groupKeywordsByClusters(keywords, clusters) {
    return clusters.map((cluster, index) => ({
      cluster_id: index + 1,
      cluster_name: this.generateClusterName(cluster),
      keywords: cluster,
      keyword_count: cluster.length,
      estimated_traffic: this.calculateClusterTraffic(cluster),
      avg_difficulty: this.calculateClusterDifficulty(cluster),
      primary_intent: this.identifyClusterIntent(cluster)
    }));
  }

  generateClusterName(keywords) {
    // Extract most common terms to generate cluster name
    const allWords = keywords.flatMap(k => k.split(' '));
    const wordFreq = {};
    
    allWords.forEach(word => {
      const stemmed = this.stemmer.stem(word.toLowerCase());
      wordFreq[stemmed] = (wordFreq[stemmed] || 0) + 1;
    });
    
    const topWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([word]) => word);
    
    return topWords.join(' ') || `Cluster ${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateClusterTraffic(keywords) {
    // Simulate traffic calculation for cluster
    return keywords.reduce((total, keyword) => {
      return total + (1000 + Math.random() * 5000); // Simulated search volume
    }, 0);
  }

  calculateClusterDifficulty(keywords) {
    // Calculate average difficulty for cluster
    const difficulties = keywords.map(() => Math.random() * 100);
    return Math.round(difficulties.reduce((a, b) => a + b, 0) / difficulties.length);
  }

  identifyClusterIntent(keywords) {
    const intentKeywords = {
      informational: ['how', 'what', 'why', 'guide', 'tutorial', 'learn'],
      commercial: ['best', 'top', 'review', 'compare', 'vs', 'alternative'],
      transactional: ['buy', 'purchase', 'price', 'cost', 'cheap', 'deal'],
      navigational: ['login', 'website', 'official', 'site']
    };
    
    const intentScores = {};
    
    Object.entries(intentKeywords).forEach(([intent, words]) => {
      intentScores[intent] = 0;
      keywords.forEach(keyword => {
        words.forEach(word => {
          if (keyword.toLowerCase().includes(word)) {
            intentScores[intent]++;
          }
        });
      });
    });
    
    return Object.entries(intentScores).reduce((a, b) => intentScores[a[0]] > intentScores[b[0]] ? a : b)[0];
  }

  identifyParentTopics(clusters) {
    return clusters.map(cluster => ({
      topic: cluster.cluster_name,
      subtopics: this.extractSubtopics(cluster.keywords),
      related_entities: this.extractEntities(cluster.keywords),
      topic_authority_score: this.calculateTopicAuthority(cluster)
    }));
  }

  extractSubtopics(keywords) {
    // Group keywords into subtopics based on modifiers
    const modifiers = ['best', 'free', 'online', 'tutorial', 'guide', 'tips', 'tools'];
    const subtopics = {};
    
    modifiers.forEach(modifier => {
      const relatedKeywords = keywords.filter(k => k.toLowerCase().includes(modifier));
      if (relatedKeywords.length > 0) {
        subtopics[modifier] = relatedKeywords;
      }
    });
    
    return subtopics;
  }

  extractEntities(keywords) {
    // Extract named entities and brands from keywords
    const commonEntities = ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'youtube'];
    const foundEntities = [];
    
    keywords.forEach(keyword => {
      commonEntities.forEach(entity => {
        if (keyword.toLowerCase().includes(entity)) {
          foundEntities.push(entity);
        }
      });
    });
    
    return [...new Set(foundEntities)];
  }

  calculateTopicAuthority(cluster) {
    // Calculate topic authority based on search volume and competition
    const baseScore = Math.min(cluster.keyword_count * 10, 100);
    const trafficBonus = Math.min(cluster.estimated_traffic / 1000, 50);
    const difficultyPenalty = cluster.avg_difficulty * 0.3;
    
    return Math.max(0, Math.round(baseScore + trafficBonus - difficultyPenalty));
  }

  extractQuestionKeywords(keywords) {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'should', 'will', 'do', 'does', 'is', 'are'];
    
    const questionKeywords = keywords.filter(keyword => {
      const words = keyword.toLowerCase().split(' ');
      return questionWords.some(qw => words.includes(qw));
    });
    
    return {
      total_questions: questionKeywords.length,
      question_types: this.categorizeQuestions(questionKeywords),
      high_volume_questions: questionKeywords.filter(() => Math.random() > 0.7), // Simulate high volume
      featured_snippet_opportunities: questionKeywords.filter(() => Math.random() > 0.8)
    };
  }

  categorizeQuestions(questions) {
    const categories = {
      'what': [], 'how': [], 'why': [], 'when': [], 'where': [], 
      'who': [], 'which': [], 'can': [], 'should': [], 'other': []
    };
    
    questions.forEach(question => {
      const firstWord = question.toLowerCase().split(' ')[0];
      if (categories[firstWord]) {
        categories[firstWord].push(question);
      } else {
        categories.other.push(question);
      }
    });
    
    return Object.fromEntries(
      Object.entries(categories).filter(([, keywords]) => keywords.length > 0)
    );
  }

  calculateClusterStats(clusters) {
    return {
      total_clusters: clusters.length,
      avg_keywords_per_cluster: Math.round(clusters.reduce((sum, c) => sum + c.keyword_count, 0) / clusters.length),
      largest_cluster_size: Math.max(...clusters.map(c => c.keyword_count)),
      total_estimated_traffic: clusters.reduce((sum, c) => sum + c.estimated_traffic, 0),
      intent_distribution: this.calculateIntentDistribution(clusters)
    };
  }

  calculateIntentDistribution(clusters) {
    const intentCounts = {};
    clusters.forEach(cluster => {
      intentCounts[cluster.primary_intent] = (intentCounts[cluster.primary_intent] || 0) + 1;
    });
    
    return intentCounts;
  }
}

// ================================
// 5. RELATED KEYWORDS & SEMANTIC ANALYSIS
// ================================

class SemanticKeywordEngine {
  constructor() {
    this.synonymDatabase = new Map();
    this.prepositions = ['with', 'for', 'in', 'on', 'at', 'by', 'from', 'to', 'of', 'about', 'under', 'over'];
    this.questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
  }

  async generateRelatedKeywords(seedKeyword) {
    const relatedKeywords = {
      synonyms: await this.findSynonyms(seedKeyword),
      semantic_variants: this.generateSemanticVariants(seedKeyword),
      long_tail_variations: this.generateLongTailVariations(seedKeyword),
      question_variants: this.generateQuestionVariants(seedKeyword),
      preposition_variants: this.generatePrepositionVariants(seedKeyword),
      competitor_keywords: await this.findCompetitorKeywords(seedKeyword),
      trending_modifiers: this.getTrendingModifiers(seedKeyword),
      seasonal_variants: this.generateSeasonalVariants(seedKeyword)
    };

    return {
      seed_keyword: seedKeyword,
      total_related_keywords: this.countTotalKeywords(relatedKeywords),
      related_keywords: relatedKeywords,
      keyword_metrics: await this.calculateRelatedKeywordMetrics(relatedKeywords)
    };
  }

  async findSynonyms(keyword) {
    // Simulate synonym finding using NLP and thesaurus data
    const synonymSets = {
      'seo': ['search engine optimization', 'organic search', 'search marketing'],
      'marketing': ['advertising', 'promotion', 'branding'],
      'tools': ['software', 'applications', 'platforms', 'solutions'],
      'guide': ['tutorial', 'handbook', 'manual', 'instructions'],
      'best': ['top', 'excellent', 'premium', 'quality', 'leading']
    };

    const words = keyword.toLowerCase().split(' ');
    const synonyms = [];

    words.forEach(word => {
      if (synonymSets[word]) {
        synonymSets[word].forEach(synonym => {
          const synonymKeyword = keyword.replace(new RegExp(word, 'gi'), synonym);
          synonyms.push({
            keyword: synonymKeyword,
            similarity_score: 0.8 + Math.random() * 0.2,
            type: 'synonym'
          });
        });
      }
    });

    return synonyms;
  }

  generateSemanticVariants(keyword) {
    const variants = [];
    const semanticModifiers = [
      'advanced', 'beginner', 'professional', 'complete', 'ultimate', 
      'comprehensive', 'detailed', 'simple', 'effective', 'proven'
    ];

    semanticModifiers.forEach(modifier => {
      variants.push({
        keyword: `${modifier} ${keyword}`,
        semantic_distance: Math.random() * 0.5 + 0.3,
        type: 'semantic_expansion'
      });

      variants.push({
        keyword: `${keyword} ${modifier}`,
        semantic_distance: Math.random() * 0.5 + 0.3,
        type: 'semantic_expansion'
      });
    });

    return variants.slice(0, 20); // Limit results
  }

  generateLongTailVariations(keyword) {
    const longTailModifiers = [
      'step by step', 'for beginners', 'in 2024', 'that work', 'examples',
      'case study', 'comparison', 'pros and cons', 'alternatives',
      'free vs paid', 'review', 'pricing', 'features'
    ];

    return longTailModifiers.map(modifier => ({
      keyword: `${keyword} ${modifier}`,
      tail_length: keyword.split(' ').length + modifier.split(' ').length,
      estimated_competition: Math.random() * 30 + 10, // Lower competition for long-tail
      type: 'long_tail'
    }));
  }

  generateQuestionVariants(keyword) {
    const questionTemplates = [
      'what is {keyword}',
      'how does {keyword} work',
      'why use {keyword}',
      'when to use {keyword}',
      'where to find {keyword}',
      'who uses {keyword}',
      'which {keyword} is best',
      'can {keyword} help',
      'should I use {keyword}',
      'will {keyword} work'
    ];

    return questionTemplates.map(template => ({
      keyword: template.replace('{keyword}', keyword),
      question_type: template.split(' ')[0],
      featured_snippet_potential: Math.random() > 0.6,
      answer_difficulty: Math.random() * 50 + 25,
      type: 'question'
    }));
  }

  generatePrepositionVariants(keyword) {
    return this.prepositions.map(prep => ({
      keyword: `${keyword} ${prep}`,
      preposition: prep,
      semantic_relationship: this.getSemanticRelationship(prep),
      type: 'preposition'
    }));
  }

  getSemanticRelationship(preposition) {
    const relationships = {
      'with': 'association', 'for': 'purpose', 'in': 'location/context',
      'on': 'platform/topic', 'at': 'location', 'by': 'method',
      'from': 'source', 'to': 'direction/purpose', 'of': 'possession/relation',
      'about': 'topic', 'under': 'category', 'over': 'comparison'
    };
    return relationships[preposition] || 'general';
  }

  async findCompetitorKeywords(keyword) {
    // Simulate competitor keyword analysis
    const competitors = ['competitor1.com', 'competitor2.com', 'competitor3.com'];
    const competitorKeywords = [];

    for (const competitor of competitors) {
      // Simulate finding keywords that competitors rank for
      const keywords = await this.getCompetitorRankings(competitor, keyword);
      competitorKeywords.push(...keywords);
    }

    return competitorKeywords.slice(0, 50); // Limit results
  }

  async getCompetitorRankings(domain, seedKeyword) {
    // Simulate competitor keyword data
    const variations = [
      `${seedKeyword} tools`, `${seedKeyword} software`, `${seedKeyword} platform`,
      `${seedKeyword} services`, `${seedKeyword} solutions`, `${seedKeyword} agency`
    ];

    return variations.map(variation => ({
      keyword: variation,
      competitor_domain: domain,
      competitor_position: Math.floor(Math.random() * 10) + 1,
      estimated_traffic: Math.floor(Math.random() * 1000) + 100,
      gap_opportunity: Math.random() > 0.7,
      type: 'competitor'
    }));
  }

  getTrendingModifiers(keyword) {
    const trendingTerms = [
      'ai powered', 'automated', 'cloud based', 'mobile friendly',
      'real time', 'data driven', 'user friendly', 'cost effective',
      'scalable', 'secure', 'innovative', 'cutting edge'
    ];

    return trendingTerms.map(trend => ({
      keyword: `${trend} ${keyword}`,
      trend_score: Math.random() * 100,
      growth_rate: (Math.random() * 50) + 10,
      type: 'trending'
    })).sort((a, b) => b.trend_score - a.trend_score).slice(0, 10);
  }

  generateSeasonalVariants(keyword) {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const events = ['black friday', 'christmas', 'new year', 'back to school'];
    const months = ['january', 'february', 'march', 'april', 'may', 'june'];

    const seasonalKeywords = [];

    seasons.forEach(season => {
      seasonalKeywords.push({
        keyword: `${keyword} ${season}`,
        seasonality_type: 'season',
        peak_months: this.getSeasonPeakMonths(season),
        volume_multiplier: 1.2 + Math.random() * 0.8,
        type: 'seasonal'
      });
    });

    events.forEach(event => {
      seasonalKeywords.push({
        keyword: `${keyword} ${event}`,
        seasonality_type: 'event',
        peak_months: this.getEventPeakMonths(event),
        volume_multiplier: 2.0 + Math.random() * 1.0,
        type: 'seasonal'
      });
    });

    return seasonalKeywords;
  }

  getSeasonPeakMonths(season) {
    const seasonMonths = {
      'spring': [3, 4, 5],
      'summer': [6, 7, 8],
      'fall': [9, 10, 11],
      'winter': [12, 1, 2]
    };
    return seasonMonths[season] || [];
  }

  getEventPeakMonths(event) {
    const eventMonths = {
      'black friday': [11],
      'christmas': [12],
      'new year': [1],
      'back to school': [8, 9]
    };
    return eventMonths[event] || [];
  }

  countTotalKeywords(relatedKeywords) {
    return Object.values(relatedKeywords).reduce((total, keywords) => {
      return total + (Array.isArray(keywords) ? keywords.length : 0);
    }, 0);
  }

  async calculateRelatedKeywordMetrics(relatedKeywords) {
    const metricsCalculator = new KeywordMetricsCalculator();
    const metrics = {
      avg_search_volume: 0,
      avg_difficulty: 0,
      high_volume_count: 0,
      low_competition_count: 0,
      question_keyword_count: 0
    };

    let totalKeywords = 0;
    let totalVolume = 0;
    let totalDifficulty = 0;

    for (const [type, keywords] of Object.entries(relatedKeywords)) {
      if (Array.isArray(keywords)) {
        keywords.forEach(keywordData => {
          const keyword = keywordData.keyword || keywordData;
          totalKeywords++;
          
          // Simulate metrics calculation
          const volume = Math.floor(Math.random() * 5000) + 100;
          const difficulty = Math.floor(Math.random() * 100);
          
          totalVolume += volume;
          totalDifficulty += difficulty;
          
          if (volume > 1000) metrics.high_volume_count++;
          if (difficulty < 30) metrics.low_competition_count++;
          if (type === 'question_variants') metrics.question_keyword_count++;
        });
      }
    }

    metrics.avg_search_volume = Math.round(totalVolume / totalKeywords);
    metrics.avg_difficulty = Math.round(totalDifficulty / totalKeywords);

    return metrics;
  }
}

// ================================
// 6. TREND ANALYSIS & SEASONALITY
// ================================

class TrendAnalysisEngine {
  constructor() {
    this.historicalData = new Map();
    this.trendPatterns = new Map();
  }

  analyzeTrends(keyword, timeframe = 12) {
    const trendData = this.generateTrendData(keyword, timeframe);
    const seasonalPatterns = this.identifySeasonalPatterns(trendData);
    const trendDirection = this.calculateTrendDirection(trendData);
    const volatility = this.calculateVolatility(trendData);
    
    return {
      keyword,
      timeframe_months: timeframe,
      trend_direction: trendDirection,
      trend_strength: this.calculateTrendStrength(trendData),
      volatility_score: volatility,
      seasonal_patterns: seasonalPatterns,
      historical_data: trendData,
      peak_periods: this.identifyPeakPeriods(trendData),
      forecast: this.generateForecast(trendData, 6),
      trend_factors: this.identifyTrendFactors(keyword, trendData)
    };
  }

  generateTrendData(keyword, months) {
    const data = [];
    const baseVolume = 1000 + Math.random() * 5000;
    
    for (let i = months; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      let volume = baseVolume;
      
      // Add seasonal variation
      const month = date.getMonth();
      volume *= this.getSeasonalMultiplier(keyword, month);
      
      // Add trend component
      const trendComponent = this.getTrendComponent(keyword, i, months);
      volume *= trendComponent;
      
      // Add random noise
      volume *= (0.8 + Math.random() * 0.4);
      
      data.push({
        date: date.toISOString().slice(0, 7),
        volume: Math.round(volume),
        normalized_volume: volume / baseVolume
      });
    }
    
    return data;
  }

  getSeasonalMultiplier(keyword, month) {
    // Simulate seasonal patterns based on keyword type
    if (keyword.includes('christmas') || keyword.includes('holiday')) {
      return month === 11 ? 3.0 : month === 10 ? 1.5 : 0.8;
    }
    
    if (keyword.includes('summer') || keyword.includes('vacation')) {
      return [5, 6, 7].includes(month) ? 2.0 : 0.9;
    }
    
    if (keyword.includes('tax') || keyword.includes('accounting')) {
      return [2, 3].includes(month) ? 2.5 : 1.0;
    }
    
    if (keyword.includes('school') || keyword.includes('education')) {
      return [8, 9].includes(month) ? 1.8 : month === 5 ? 0.6 : 1.0;
    }
    
    // Default slight seasonal variation
    return 0.9 + (Math.sin(month * Math.PI / 6) * 0.2);
  }

  getTrendComponent(keyword, monthsAgo, totalMonths) {
    // Simulate different trend patterns
    const progress = (totalMonths - monthsAgo) / totalMonths;
    
    if (keyword.includes('ai') || keyword.includes('artificial intelligence')) {
      // Growing trend
      return 0.5 + (progress * 1.5);
    }
    
    if (keyword.includes('flash') || keyword.includes('fax')) {
      // Declining trend  
      return 1.5 - (progress * 1.0);
    }
    
    if (keyword.includes('covid') || keyword.includes('pandemic')) {
      // Spike and decline pattern
      return progress < 0.3 ? (1 + progress * 3) : (2.5 - progress * 1.5);
    }
    
    // Stable trend with slight variations
    return 1.0 + (Math.sin(progress * Math.PI * 2) * 0.1);
  }

  identifySeasonalPatterns(data) {
    const monthlyAvgs = {};
    
    data.forEach(point => {
      const month = new Date(point.date).getMonth();
      if (!monthlyAvgs[month]) monthlyAvgs[month] = [];
      monthlyAvgs[month].push(point.volume);
    });
    
    // Calculate average volume per month
    const seasonalData = Object.entries(monthlyAvgs).map(([month, volumes]) => ({
      month: parseInt(month),
      month_name: new Date(2024, month, 1).toLocaleString('default', { month: 'long' }),
      avg_volume: Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length),
      seasonal_index: volumes.reduce((a, b) => a + b, 0) / volumes.length / (data.reduce((sum, d) => sum + d.volume, 0) / data.length)
    }));
    
    return {
      seasonal_data: seasonalData.sort((a, b) => a.month - b.month),
      peak_month: seasonalData.reduce((max, curr) => curr.avg_volume > max.avg_volume ? curr : max),
      low_month: seasonalData.reduce((min, curr) => curr.avg_volume < min.avg_volume ? curr : min),
      seasonality_strength: this.calculateSeasonalityStrength(seasonalData)
    };
  }

  calculateSeasonalityStrength(seasonalData) {
    const volumes = seasonalData.map(d => d.avg_volume);
    const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - mean, 2), 0) / volumes.length;
    const coefficient = Math.sqrt(variance) / mean;
    
    if (coefficient < 0.1) return 'Low';
    if (coefficient < 0.3) return 'Moderate';
    return 'High';
  }

  calculateTrendDirection(data) {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.volume, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.volume, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return 'Growing';
    if (change < -10) return 'Declining';
    return 'Stable';
  }

  calculateTrendStrength(data) {
    // Calculate linear regression slope to determine trend strength
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    data.forEach((point, index) => {
      sumX += index;
      sumY += point.volume;
      sumXY += index * point.volume;
      sumXX += index * index;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgY = sumY / n;
    
    // Normalize slope by average volume
    const normalizedSlope = Math.abs(slope) / avgY;
    
    if (normalizedSlope < 0.01) return 'Weak';
    if (normalizedSlope < 0.05) return 'Moderate';
    return 'Strong';
  }

  calculateVolatility(data) {
    const volumes = data.map(d => d.volume);
    const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - mean, 2), 0) / volumes.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.round((stdDev / mean) * 100);
  }

  identifyPeakPeriods(data) {
    const peaks = [];
    const threshold = 1.2; // 20% above average
    
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    data.forEach((point, index) => {
      if (point.volume > avgVolume * threshold) {
        peaks.push({
          date: point.date,
          volume: point.volume,
          peak_ratio: point.volume / avgVolume,
          context: this.getPeakContext(point.date)
        });
      }
    });
    
    return peaks;
  }

  getPeakContext(date) {
    const month = new Date(date).getMonth();
    const contexts = {
      0: 'New Year planning',
      1: 'Valentine\'s Day',
      2: 'Tax season',
      3: 'Spring planning',  
      4: 'Mother\'s Day',
      5: 'Summer preparation',
      6: 'Mid-year reviews',
      7: 'Back to school',
      8: 'Fall planning',
      9: 'Halloween/Q4 prep',
      10: 'Black Friday prep',
      11: 'Holiday season'
    };
    
    return contexts[month] || 'General seasonal pattern';
  }
}
  // ================================
// COMPLETE KEYWORD RESEARCH PLATFORM
// ================================

// First, let's complete the TrendAnalysisEngine from your existing code
class TrendAnalysisEngine {
  constructor() {
    this.historicalData = new Map();
    this.trendPatterns = new Map();
  }

  // ... (keeping your existing methods)

  generateForecast(historicalData, forecastMonths) {
    const forecast = [];
    const recentTrend = this.calculateRecentTrend(historicalData);
    const seasonalPattern = this.extractSeasonalPattern(historicalData);
    
    for (let i = 1; i <= forecastMonths; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      
      const lastVolume = historicalData[historicalData.length - 1].volume;
      const trendAdjustment = recentTrend * i;
      const seasonalAdjustment = seasonalPattern[futureDate.getMonth() % 12] || 1.0;
      
      const forecastedVolume = Math.round(lastVolume * (1 + trendAdjustment/100) * seasonalAdjustment);
      
      forecast.push({
        date: futureDate.toISOString().slice(0, 7),
        forecasted_volume: Math.max(0, forecastedVolume),
        confidence_interval: this.calculateConfidenceInterval(forecastedVolume, i),
        factors: {
          trend_component: trendAdjustment,
          seasonal_component: seasonalAdjustment,
          base_volume: lastVolume
        }
      });
    }
    
    return forecast;
  }

  calculateRecentTrend(data) {
    const recentData = data.slice(-6); // Last 6 months
    if (recentData.length < 2) return 0;
    
    const firstValue = recentData[0].volume;
    const lastValue = recentData[recentData.length - 1].volume;
    
    return ((lastValue - firstValue) / firstValue) * 100 / recentData.length;
  }

  extractSeasonalPattern(data) {
    const monthlyMultipliers = {};
    const monthlyData = {};
    
    data.forEach(point => {
      const month = new Date(point.date).getMonth();
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(point.volume);
    });
    
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    
    for (let month = 0; month < 12; month++) {
      if (monthlyData[month]) {
        const monthAvg = monthlyData[month].reduce((a, b) => a + b, 0) / monthlyData[month].length;
        monthlyMultipliers[month] = monthAvg / avgVolume;
      } else {
        monthlyMultipliers[month] = 1.0;
      }
    }
    
    return monthlyMultipliers;
  }

  calculateConfidenceInterval(value, monthsAhead) {
    const uncertainty = 0.05 + (monthsAhead * 0.02); // Increasing uncertainty over time
    return {
      lower_bound: Math.round(value * (1 - uncertainty)),
      upper_bound: Math.round(value * (1 + uncertainty)),
      confidence_level: Math.max(0.6, 0.95 - (monthsAhead * 0.05))
    };
  }

  identifyTrendFactors(keyword, trendData) {
    const factors = [];
    
    // Analyze growth patterns
    const growth = this.calculateTrendDirection(trendData);
    if (growth === 'Growing') {
      factors.push({
        factor: 'Market Growth',
        impact: 'Positive',
        description: 'Increasing search interest over time'
      });
    }
    
    // Check for technology trends
    if (keyword.includes('ai') || keyword.includes('machine learning')) {
      factors.push({
        factor: 'Technology Adoption',
        impact: 'Positive',
        description: 'Rising interest in AI and automation'
      });
    }
    
    // Check for seasonal business cycles
    const seasonality = this.identifySeasonalPatterns(trendData);
    if (seasonality.seasonality_strength === 'High') {
      factors.push({
        factor: 'Seasonal Demand',
        impact: 'Variable',
        description: `Peak interest during ${seasonality.peak_month.month_name}`
      });
    }
    
    return factors;
  }
}

// ================================
// 6. SERP POSITION HISTORY & TRACKING
// ================================

class SERPPositionTracker {
  constructor() {
    this.positionHistory = new Map();
    this.rankingFactors = new Map();
  }

  async trackKeywordPositions(keyword, competitors = [], days = 90) {
    const positionData = await this.generatePositionHistory(keyword, competitors, days);
    const volatility = this.calculateRankingVolatility(positionData);
    const trends = this.analyzeRankingTrends(positionData);
    
    return {
      keyword,
      tracking_period_days: days,
      position_history: positionData,
      current_rankings: this.getCurrentRankings(positionData),
      ranking_volatility: volatility,
      ranking_trends: trends,
      serp_features_history: await this.trackSERPFeatures(keyword, days),
      competitor_movements: this.analyzeCompetitorMovements(positionData),
      ranking_opportunities: this.identifyRankingOpportunities(positionData)
    };
  }

  async generatePositionHistory(keyword, competitors, days) {
    const history = [];
    const domains = ['your-site.com', ...competitors];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dayData = {
        date: date.toISOString().slice(0, 10),
        rankings: {}
      };
      
      domains.forEach(domain => {
        // Simulate realistic ranking movements
        const basePosition = this.getBasePosition(domain, keyword);
        const dailyVariation = this.calculateDailyVariation(domain, i, days);
        const position = Math.max(1, Math.min(100, basePosition + dailyVariation));
        
        dayData.rankings[domain] = {
          position: Math.round(position),
          url: this.generateRankingURL(domain, keyword),
          title: this.generateSERPTitle(domain, keyword),
          estimated_traffic: this.calculateEstimatedTraffic(position, keyword),
          serp_features: this.getActiveSERPFeatures(position, date)
        };
      });
      
      history.push(dayData);
    }
    
    return history;
  }

  getBasePosition(domain, keyword) {
    // Simulate different domains having different base authority
    const domainStrengths = {
      'your-site.com': 25 + Math.random() * 20,
      'competitor1.com': 15 + Math.random() * 15,
      'competitor2.com': 10 + Math.random() * 25,
      'competitor3.com': 35 + Math.random() * 15
    };
    
    return domainStrengths[domain] || (50 + Math.random() * 40);
  }

  calculateDailyVariation(domain, dayIndex, totalDays) {
    // Simulate ranking algorithm updates and natural fluctuations
    const algorithmUpdates = [20, 45, 70]; // Days when updates occurred
    let variation = (Math.random() - 0.5) * 4; // Base daily variation
    
    // Add algorithm update impacts
    algorithmUpdates.forEach(updateDay => {
      if (Math.abs(dayIndex - updateDay) < 3) {
        variation += (Math.random() - 0.5) * 15; // Larger movements during updates
      }
    });
    
    // Add gradual trend improvements/declines
    const trendComponent = Math.sin((dayIndex / totalDays) * Math.PI) * 3;
    
    return variation + trendComponent;
  }

  generateRankingURL(domain, keyword) {
    const slugs = keyword.toLowerCase().replace(/\s+/g, '-');
    const paths = ['blog', 'guides', 'resources', 'tools', ''];
    const randomPath = paths[Math.floor(Math.random() * paths.length)];
    return `https://${domain}/${randomPath}${randomPath ? '/' : ''}${slugs}`;
  }

  generateSERPTitle(domain, keyword) {
    const templates = [
      `${keyword} - Complete Guide | ${domain}`,
      `Best ${keyword} Tips and Strategies`,
      `${keyword}: Everything You Need to Know`,
      `Ultimate ${keyword} Resource Center`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  calculateEstimatedTraffic(position, keyword) {
    // CTR curves based on position
    const ctrByPosition = {
      1: 0.284, 2: 0.147, 3: 0.094, 4: 0.067, 5: 0.051,
      6: 0.041, 7: 0.034, 8: 0.029, 9: 0.025, 10: 0.022
    };
    
    const ctr = ctrByPosition[position] || (0.02 / (position - 9));
    const estimatedVolume = 1000 + Math.random() * 5000; // Simulated search volume
    
    return Math.round(estimatedVolume * ctr);
  }

  getActiveSERPFeatures(position, date) {
    const features = [];
    
    if (position <= 3 && Math.random() > 0.7) features.push('featured_snippet');
    if (position <= 5 && Math.random() > 0.6) features.push('people_also_ask');
    if (Math.random() > 0.8) features.push('image_pack');
    if (Math.random() > 0.9) features.push('video_carousel');
    if (position <= 10 && Math.random() > 0.5) features.push('related_searches');
    
    return features;
  }

  calculateRankingVolatility(positionData) {
    const volatilityScores = {};
    
    // Calculate volatility for each domain
    Object.keys(positionData[0].rankings).forEach(domain => {
      const positions = positionData.map(day => day.rankings[domain].position);
      const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
      const variance = positions.reduce((sum, pos) => sum + Math.pow(pos - mean, 2), 0) / positions.length;
      
      volatilityScores[domain] = {
        volatility_score: Math.round(Math.sqrt(variance) * 10) / 10,
        average_position: Math.round(mean * 10) / 10,
        position_range: {
          best: Math.min(...positions),
          worst: Math.max(...positions)
        }
      };
    });
    
    return volatilityScores;
  }

  analyzeRankingTrends(positionData) {
    const trends = {};
    
    Object.keys(positionData[0].rankings).forEach(domain => {
      const positions = positionData.map(day => day.rankings[domain].position);
      const firstWeek = positions.slice(0, 7);
      const lastWeek = positions.slice(-7);
      
      const firstAvg = firstWeek.reduce((a, b) => a + b, 0) / firstWeek.length;
      const lastAvg = lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length;
      
      const change = firstAvg - lastAvg; // Positive means improvement (lower position number)
      
      trends[domain] = {
        trend_direction: change > 2 ? 'Improving' : change < -2 ? 'Declining' : 'Stable',
        position_change: Math.round(change * 10) / 10,
        trend_strength: Math.abs(change) > 5 ? 'Strong' : Math.abs(change) > 2 ? 'Moderate' : 'Weak'
      };
    });
    
    return trends;
  }

  async trackSERPFeatures(keyword, days) {
    const features = [];
    
    for (let i = days; i >= 0; i -= 7) { // Weekly snapshots
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      features.push({
        date: date.toISOString().slice(0, 10),
        active_features: this.generateSERPFeaturesSnapshot(keyword, date),
        feature_owners: this.identifyFeatureOwners(keyword)
      });
    }
    
    return features;
  }

  generateSERPFeaturesSnapshot(keyword, date) {
    const allFeatures = [
      'featured_snippet', 'people_also_ask', 'image_pack', 'video_carousel',
      'news_results', 'shopping_results', 'local_pack', 'knowledge_panel',
      'related_searches', 'site_links', 'reviews', 'recipes'
    ];
    
    return allFeatures.filter(() => Math.random() > 0.6);
  }

  identifyFeatureOwners(keyword) {
    return {
      featured_snippet: Math.random() > 0.5 ? 'wikipedia.org' : 'competitor1.com',
      people_also_ask: ['quora.com', 'reddit.com', 'stackexchange.com'],
      image_pack: ['pinterest.com', 'shutterstock.com', 'unsplash.com'],
      video_carousel: ['youtube.com', 'vimeo.com']
    };
  }

  analyzeCompetitorMovements(positionData) {
    const movements = {};
    
    Object.keys(positionData[0].rankings).forEach(domain => {
      if (domain === 'your-site.com') return;
      
      const positions = positionData.map(day => day.rankings[domain].position);
      const recentPositions = positions.slice(-30); // Last 30 days
      
      movements[domain] = {
        current_position: positions[positions.length - 1],
        monthly_change: positions[positions.length - 30] - positions[positions.length - 1],
        biggest_jump: this.findBiggestMovement(positions, 'up'),
        biggest_drop: this.findBiggestMovement(positions, 'down'),
        consistency_score: this.calculateConsistency(recentPositions)
      };
    });
    
    return movements;
  }

  findBiggestMovement(positions, direction) {
    let biggestMove = 0;
    let moveDate = null;
    
    for (let i = 1; i < positions.length; i++) {
      const change = positions[i - 1] - positions[i]; // Positive = improvement
      
      if (direction === 'up' && change > biggestMove) {
        biggestMove = change;
        moveDate = i;
      } else if (direction === 'down' && change < biggestMove) {
        biggestMove = Math.abs(change);
        moveDate = i;
      }
    }
    
    return { positions: Math.round(biggestMove), days_ago: positions.length - moveDate };
  }

  calculateConsistency(positions) {
    const mean = positions.reduce((a, b) => a + b, 0) / positions.length;
    const variance = positions.reduce((sum, pos) => sum + Math.pow(pos - mean, 2), 0) / positions.length;
    const coefficient = Math.sqrt(variance) / mean;
    
    return Math.round((1 - Math.min(coefficient, 1)) * 100);
  }

  identifyRankingOpportunities(positionData) {
    const opportunities = [];
    const yourSite = 'your-site.com';
    
    if (!positionData[0].rankings[yourSite]) return opportunities;
    
    const yourPositions = positionData.map(day => day.rankings[yourSite].position);
    const currentPosition = yourPositions[yourPositions.length - 1];
    
    // Opportunity 1: Recently dropped competitors
    Object.keys(positionData[0].rankings).forEach(domain => {
      if (domain === yourSite) return;
      
      const theirPositions = positionData.map(day => day.rankings[domain].position);
      const recentDrop = theirPositions[theirPositions.length - 7] - theirPositions[theirPositions.length - 1];
      
      if (recentDrop < -5 && theirPositions[theirPositions.length - 1] < currentPosition) {
        opportunities.push({
          type: 'competitor_weakness',
          competitor: domain,
          description: `${domain} dropped ${Math.abs(recentDrop)} positions recently`,
          potential_gain: Math.min(currentPosition - theirPositions[theirPositions.length - 1], 10)
        });
      }
    });
    
    // Opportunity 2: SERP feature gaps
    const recentFeatures = positionData.slice(-7).flatMap(day => 
      day.rankings[yourSite].serp_features || []
    );
    
    if (!recentFeatures.includes('featured_snippet') && currentPosition <= 10) {
      opportunities.push({
        type: 'serp_feature',
        feature: 'featured_snippet',
        description: 'No featured snippet captured - optimize for question queries',
        potential_impact: 'High CTR boost'
      });
    }
    
    return opportunities;
  }

  getCurrentRankings(positionData) {
    const latestData = positionData[positionData.length - 1];
    return Object.entries(latestData.rankings).map(([domain, data]) => ({
      domain,
      position: data.position,
      url: data.url,
      title: data.title,
      estimated_traffic: data.estimated_traffic,
      active_serp_features: data.serp_features || []
    })).sort((a, b) => a.position - b.position);
  }
}

// ================================
// 7. KEYWORD INTENT CLASSIFICATION ENGINE
// ================================

class KeywordIntentClassifier {
  constructor() {
    this.intentPatterns = this.initializeIntentPatterns();
    this.mlModel = new SimpleMLClassifier();
  }

  initializeIntentPatterns() {
    return {
      informational: {
        keywords: ['what', 'how', 'why', 'when', 'where', 'who', 'guide', 'tutorial', 'learn', 'meaning', 'definition', 'explain', 'understand'],
        patterns: [/what is/i, /how to/i, /guide to/i, /tutorial/i, /learn/i, /meaning of/i],
        serp_indicators: ['featured_snippet', 'people_also_ask', 'knowledge_panel']
      },
      
      navigational: {
        keywords: ['login', 'sign in', 'website', 'official', 'homepage', 'portal', 'dashboard'],
        patterns: [/\b\w+ login/i, /\b\w+ website/i, /official \w+/i],
        serp_indicators: ['site_links', 'knowledge_panel']
      },
      
      commercial: {
        keywords: ['best', 'top', 'review', 'compare', 'vs', 'alternative', 'recommendation', 'software', 'tool', 'service'],
        patterns: [/best \w+/i, /top \d+/i, /\w+ vs \w+/i, /\w+ review/i, /compare \w+/i],
        serp_indicators: ['shopping_results', 'reviews', 'ads']
      },
      
      transactional: {
        keywords: ['buy', 'purchase', 'order', 'price', 'cost', 'cheap', 'discount', 'deal', 'sale', 'shop', 'store'],
        patterns: [/buy \w+/i, /\w+ price/i, /cheap \w+/i, /\w+ for sale/i, /order \w+/i],
        serp_indicators: ['shopping_results', 'ads', 'local_pack']
      }
    };
  }

  classifyKeyword(keyword, serpFeatures = [], additionalContext = {}) {
    const intentScores = this.calculateIntentScores(keyword, serpFeatures);
    const primaryIntent = this.determinePrimaryIntent(intentScores);
    const confidence = this.calculateConfidence(intentScores, primaryIntent);
    
    return {
      keyword,
      primary_intent: primaryIntent,
      confidence_score: confidence,
      intent_scores: intentScores,
      intent_indicators: this.getIntentIndicators(keyword, serpFeatures),
      commercial_value: this.calculateCommercialValue(primaryIntent, intentScores),
      funnel_stage: this.determineFunnelStage(primaryIntent),
      content_recommendations: this.generateContentRecommendations(primaryIntent, keyword)
    };
  }

  calculateIntentScores(keyword, serpFeatures) {
    const scores = {
      informational: 0,
      navigational: 0,
      commercial: 0,
      transactional: 0
    };

    const keywordLower = keyword.toLowerCase();
    
    // Score based on keyword patterns
    Object.entries(this.intentPatterns).forEach(([intent, patterns]) => {
      // Keyword matching
      patterns.keywords.forEach(kw => {
        if (keywordLower.includes(kw)) {
          scores[intent] += 1;
        }
      });
      
      // Pattern matching
      patterns.patterns.forEach(pattern => {
        if (pattern.test(keyword)) {
          scores[intent] += 2;
        }
      });
      
      // SERP feature indicators
      if (serpFeatures && serpFeatures.length > 0) {
        patterns.serp_indicators.forEach(indicator => {
          if (serpFeatures.includes(indicator)) {
            scores[intent] += 1.5;
          }
        });
      }
    });

    // Additional heuristics
    scores.informational += this.calculateInformationalSignals(keyword);
    scores.commercial += this.calculateCommercialSignals(keyword);
    scores.transactional += this.calculateTransactionalSignals(keyword);
    scores.navigational += this.calculateNavigationalSignals(keyword);

    // Normalize scores
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      Object.keys(scores).forEach(intent => {
        scores[intent] = Math.round((scores[intent] / maxScore) * 100);
      });
    }

    return scores;
  }

  calculateInformationalSignals(keyword) {
    let score = 0;
    
    // Question words at the beginning
    if (/^(what|how|why|when|where|who|which|can|should|will|do|does|is|are)\b/i.test(keyword)) {
      score += 3;
    }
    
    // Educational terms
    if (/\b(guide|tutorial|tips|advice|help|learn|course|training|example)\b/i.test(keyword)) {
      score += 2;
    }
    
    // Problem-solving terms
    if (/\b(problem|issue|error|fix|solve|troubleshoot)\b/i.test(keyword)) {
      score += 2;
    }
    
    return score;
  }

  calculateCommercialSignals(keyword) {
    let score = 0;
    
    // Comparison terms
    if (/\b(best|top|compare|vs|versus|alternative|option|choice)\b/i.test(keyword)) {
      score += 3;
    }
    
    // Review terms
    if (/\b(review|rating|testimonial|feedback|opinion)\b/i.test(keyword)) {
      score += 2;
    }
    
    // Product/service qualifiers
    if (/\b(software|tool|service|platform|solution|app|product)\b/i.test(keyword)) {
      score += 1;
    }
    
    return score;
  }

  calculateTransactionalSignals(keyword) {
    let score = 0;
    
    // Purchase intent
    if (/\b(buy|purchase|order|get|download|subscribe|hire)\b/i.test(keyword)) {
      score += 4;
    }
    
    // Price-related
    if (/\b(price|cost|pricing|cheap|affordable|expensive|budget|deal|discount|sale)\b/i.test(keyword)) {
      score += 3;
    }
    
    // Location + service
    if (/\b(near me|in [A-Z][a-z]+|local)\b/i.test(keyword)) {
      score += 2;
    }
    
    return score;
  }

  calculateNavigationalSignals(keyword) {
    let score = 0;
    
    // Brand + generic terms
    if (/\b(login|sign in|website|site|official|homepage|contact|support)\b/i.test(keyword)) {
      score += 3;
    }
    
    // Looks like a brand name (capitalized words)
    if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(keyword)) {
      score += 2;
    }
    
    return score;
  }

  determinePrimaryIntent(intentScores) {
    return Object.entries(intentScores).reduce((max, [intent, score]) => 
      score > intentScores[max] ? intent : max
    );
  }

  calculateConfidence(intentScores, primaryIntent) {
    const primaryScore = intentScores[primaryIntent];
    const secondaryScore = Math.max(...Object.values(intentScores).filter(score => score !== primaryScore));
    
    if (primaryScore === 0) return 0;
    
    const confidence = ((primaryScore - secondaryScore) / primaryScore) * 100;
    return Math.round(Math.max(0, Math.min(100, confidence)));
  }

  getIntentIndicators(keyword, serpFeatures) {
    const indicators = [];
    
    // Keyword-based indicators
    if (/^(how|what|why)\b/i.test(keyword)) {
      indicators.push('Question-based query');
    }
    
    if (/\b(best|top|review)\b/i.test(keyword)) {
      indicators.push('Comparison intent');
    }
    
    if (/\b(buy|price|cost)\b/i.test(keyword)) {
      indicators.push('Purchase intent');
    }
    
    // SERP-based indicators
    if (serpFeatures.includes('shopping_results')) {
      indicators.push('Shopping results present');
    }
    
    if (serpFeatures.includes('featured_snippet')) {
      indicators.push('Featured snippet opportunity');
    }
    
    if (serpFeatures.includes('people_also_ask')) {
      indicators.push('FAQ-style content needed');
    }
    
    return indicators;
  }

  calculateCommercialValue(primaryIntent, intentScores) {
    const commercialWeights = {
      transactional: 100,
      commercial: 80,
      navigational: 40,
      informational: 20
    };
    
    let weightedScore = 0;
    Object.entries(intentScores).forEach(([intent, score]) => {
      weightedScore += (score / 100) * commercialWeights[intent];
    });
    
    return {
      score: Math.round(weightedScore),
      level: weightedScore > 80 ? 'High' : weightedScore > 50 ? 'Medium' : 'Low',
      monetization_potential: this.getMonetizationPotential(primaryIntent)
    };
  }

  getMonetizationPotential(intent) {
    const potentials = {
      transactional: ['Direct sales', 'Affiliate marketing', 'Lead generation'],
      commercial: ['Affiliate marketing', 'Sponsored content', 'Lead magnets'],
      navigational: ['Brand awareness', 'Customer support', 'User retention'],
      informational: ['Content marketing', 'Brand building', 'Email capture']
    };
    
    return potentials[intent] || [];
  }

  determineFunnelStage(primaryIntent) {
    const funnelMapping = {
      informational: 'Top of Funnel (Awareness)',
      commercial: 'Middle of Funnel (Consideration)',
      transactional: 'Bottom of Funnel (Purchase)',
      navigational: 'Retention/Support'
    };
    
    return funnelMapping[primaryIntent];
  }

  generateContentRecommendations(primaryIntent, keyword) {
    const recommendations = {
      informational: [
        'Create comprehensive guides and tutorials',
        'Develop FAQ sections',
        'Use clear headings and subheadings',
        'Include step-by-step instructions',
        'Add relevant images and videos',
        'Optimize for featured snippets'
      ],
      
      commercial: [
        'Create comparison pages and reviews',
        'Include pros and cons lists',
        'Add user testimonials and case studies',
        'Create "best of" roundup articles',
        'Include pricing comparisons',
        'Add clear calls-to-action'
      ],
      
      transactional: [
        'Optimize product/service pages',
        'Include clear pricing information',
        'Add customer reviews and ratings',
        'Create compelling product descriptions',
        'Include trust signals and guarantees',
        'Optimize for local search if applicable'
      ],
      
      navigational: [
        'Ensure brand pages are optimized',
        'Create clear site navigation',
        'Include contact information',
        'Add brand-specific landing pages',
        'Optimize for branded keywords',
        'Include site search functionality'
      ]
    };
    
    return recommendations[primaryIntent] || [];
  }

  batchClassifyKeywords(keywords, contextData = {}) {
    return keywords.map(keyword => {
      const serpFeatures = contextData[keyword]?.serpFeatures || [];
      return this.classifyKeyword(keyword, serpFeatures, contextData[keyword]);
    });
  }
}

// Simple ML classifier for intent prediction
// Continuing from your provided code...

// Complete the SimpleMLClassifier
class SimpleMLClassifier {
  constructor() {
    this.features = [];
    this.weights = {};
    this.trained = false;
  }

  // Feature extraction for intent classification
  extractFeatures(keyword) {
    const features = {
      length: keyword.length,
      wordCount: keyword.split(' ').length,
      hasQuestionWord: /^(what|how|why|when|where|who|which|can|should|will|do|does|is|are)\b/i.test(keyword),
      hasBuyingWord: /\b(buy|purchase|order|get|price|cost|cheap|deal)\b/i.test(keyword),
      hasComparisonWord: /\b(best|top|compare|vs|review|alternative)\b/i.test(keyword),
      hasBrandIndicator: /\b(login|website|official|homepage)\b/i.test(keyword),
      hasNumbers: /\d+/.test(keyword),
      hasLocation: /\b(near me|in [A-Z][a-z]+|local)\b/i.test(keyword)
    };
    
    return features;
  }

  predict(keyword) {
    if (!this.trained) {
      // Return basic heuristic-based prediction
      const features = this.extractFeatures(keyword);
      
      if (features.hasBuyingWord) return 'transactional';
      if (features.hasComparisonWord) return 'commercial';
      if (features.hasBrandIndicator) return 'navigational';
      if (features.hasQuestionWord) return 'informational';
      
      return 'informational'; // default
    }
    
    // If trained, use weights (simplified implementation)
    const features = this.extractFeatures(keyword);
    const scores = {
      informational: 0,
      navigational: 0,
      commercial: 0,
      transactional: 0
    };
    
    Object.entries(features).forEach(([feature, value]) => {
      if (this.weights[feature]) {
        Object.keys(scores).forEach(intent => {
          scores[intent] += value * (this.weights[feature][intent] || 0);
        });
      }
    });
    
    return Object.entries(scores).reduce((max, [intent, score]) => 
      score > scores[max] ? intent : max
    );
  }
}

// ================================
// 8. COMPLETE KEYWORD RESEARCH PLATFORM
// ================================

class KeywordResearchPlatform {
  constructor() {
    this.dataSourceEngine = new DataSourceEngine();
    this.metricsCalculator = new KeywordMetricsCalculator();
    this.serpAnalyzer = new SERPAnalysisEngine();
    this.groupingEngine = new KeywordGroupingEngine();
    this.semanticAnalyzer = new SemanticAnalysisEngine();
    this.trendAnalyzer = new TrendAnalysisEngine();
    this.positionTracker = new SERPPositionTracker();
    this.intentClassifier = new KeywordIntentClassifier();
    this.cache = new Map();
    this.updateQueue = [];
  }

  // Main keyword research method
  async performKeywordResearch(seedKeyword, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`Starting keyword research for: "${seedKeyword}"`);
      
      // Step 1: Discover related keywords
      const discoveredKeywords = await this.dataSourceEngine.discoverKeywords(
        seedKeyword, 
        options.maxResults || 1000
      );
      
      // Step 2: Calculate metrics for all keywords
      const keywordsWithMetrics = await this.calculateBatchMetrics(discoveredKeywords);
      
      // Step 3: Analyze SERP for top keywords
      const topKeywords = keywordsWithMetrics
        .sort((a, b) => b.search_volume - a.search_volume)
        .slice(0, 50);
      
      const serpAnalysis = await this.analyzeBatchSERP(topKeywords);
      
      // Step 4: Group and cluster keywords
      const keywordGroups = await this.groupingEngine.clusterKeywords(keywordsWithMetrics);
      
      // Step 5: Semantic analysis
      const semanticData = await this.semanticAnalyzer.generateSemanticAnalysis(
        seedKeyword, 
        keywordsWithMetrics
      );
      
      // Step 6: Trend analysis
      const trendData = await this.trendAnalyzer.analyzeKeywordTrends(seedKeyword);
      
      // Step 7: Intent classification
      const intentData = this.intentClassifier.batchClassifyKeywords(
        keywordsWithMetrics.map(k => k.keyword)
      );
      
      // Step 8: Position tracking (for seed keyword)
      const positionData = await this.positionTracker.trackKeywordPositions(
        seedKeyword,
        options.competitors || []
      );

      // Compile comprehensive report
      const report = this.compileResearchReport({
        seedKeyword,
        discoveredKeywords: keywordsWithMetrics,
        serpAnalysis,
        keywordGroups,
        semanticData,
        trendData,
        intentData,
        positionData,
        processingTime: Date.now() - startTime
      });

      // Cache results
      this.cacheResults(seedKeyword, report);
      
      return report;
      
    } catch (error) {
      console.error('Keyword research failed:', error);
      throw new Error(`Keyword research failed: ${error.message}`);
    }
  }

  async calculateBatchMetrics(keywords) {
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (keyword) => {
          const metrics = await this.metricsCalculator.calculateAllMetrics(keyword);
          return { keyword, ...metrics };
        })
      );
      results.push(...batchResults);
      
      // Rate limiting
      if (i + batchSize < keywords.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async analyzeBatchSERP(keywords) {
    const serpResults = {};
    
    for (const keywordData of keywords) {
      try {
        const analysis = await this.serpAnalyzer.analyzeSERP(keywordData.keyword);
        serpResults[keywordData.keyword] = analysis;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`SERP analysis failed for ${keywordData.keyword}:`, error);
        serpResults[keywordData.keyword] = null;
      }
    }
    
    return serpResults;
  }

  compileResearchReport(data) {
    return {
      overview: {
        seed_keyword: data.seedKeyword,
        total_keywords_found: data.discoveredKeywords.length,
        processing_time_ms: data.processingTime,
        analysis_timestamp: new Date().toISOString(),
        data_freshness: this.calculateDataFreshness()
      },
      
      keyword_metrics: {
        keywords: data.discoveredKeywords,
        top_volume_keywords: this.getTopKeywordsByMetric(data.discoveredKeywords, 'search_volume', 20),
        low_competition_opportunities: this.getLowCompetitionOpportunities(data.discoveredKeywords),
        high_cpc_keywords: this.getTopKeywordsByMetric(data.discoveredKeywords, 'cpc', 10)
      },
      
      serp_analysis: data.serpAnalysis,
      
      keyword_groups: data.keywordGroups,
      
      semantic_analysis: data.semanticData,
      
      trend_analysis: data.trendData,
      
      intent_classification: {
        intent_distribution: this.calculateIntentDistribution(data.intentData),
        by_keyword: data.intentData
      },
      
      position_tracking: data.positionData,
      
      opportunities: this.identifyKeywordOpportunities(data),
      
      content_suggestions: this.generateContentSuggestions(data),
      
      export_data: {
        csv_ready: this.prepareCsvExport(data.discoveredKeywords),
        api_endpoints: this.generateApiEndpoints(data.seedKeyword)
      }
    };
  }

  getTopKeywordsByMetric(keywords, metric, limit) {
    return keywords
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
      .slice(0, limit)
      .map(k => ({
        keyword: k.keyword,
        value: k[metric],
        search_volume: k.search_volume,
        difficulty: k.keyword_difficulty
      }));
  }

  getLowCompetitionOpportunities(keywords) {
    return keywords
      .filter(k => k.keyword_difficulty < 30 && k.search_volume > 100)
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 15)
      .map(k => ({
        keyword: k.keyword,
        search_volume: k.search_volume,
        difficulty: k.keyword_difficulty,
        cpc: k.cpc,
        opportunity_score: this.calculateOpportunityScore(k)
      }));
  }

  calculateOpportunityScore(keyword) {
    const volume = keyword.search_volume || 0;
    const difficulty = keyword.keyword_difficulty || 100;
    const cpc = keyword.cpc || 0;
    
    // Higher volume, lower difficulty, higher CPC = better opportunity
    return Math.round(((volume / 1000) * (100 - difficulty) * (cpc * 10)) / 100);
  }

  calculateIntentDistribution(intentData) {
    const distribution = {
      informational: 0,
      navigational: 0,
      commercial: 0,
      transactional: 0
    };
    
    intentData.forEach(item => {
      distribution[item.primary_intent]++;
    });
    
    const total = intentData.length;
    Object.keys(distribution).forEach(intent => {
      distribution[intent] = Math.round((distribution[intent] / total) * 100);
    });
    
    return distribution;
  }

  identifyKeywordOpportunities(data) {
    const opportunities = [];
    
    // Quick wins (low difficulty, decent volume)
    const quickWins = data.discoveredKeywords.filter(k => 
      k.keyword_difficulty < 25 && k.search_volume > 200
    );
    
    if (quickWins.length > 0) {
      opportunities.push({
        type: 'quick_wins',
        count: quickWins.length,
        description: 'Low competition keywords with good search volume',
        keywords: quickWins.slice(0, 10).map(k => k.keyword)
      });
    }
    
    // Long-tail opportunities
    const longTail = data.discoveredKeywords.filter(k => 
      k.keyword.split(' ').length >= 4 && k.search_volume > 50
    );
    
    if (longTail.length > 0) {
      opportunities.push({
        type: 'long_tail',
        count: longTail.length,
        description: 'Long-tail keywords for specific targeting',
        keywords: longTail.slice(0, 10).map(k => k.keyword)
      });
    }
    
    // Question keywords
    const questions = data.discoveredKeywords.filter(k => 
      /^(what|how|why|when|where|who|which|can|should|will|do|does|is|are)\b/i.test(k.keyword)
    );
    
    if (questions.length > 0) {
      opportunities.push({
        type: 'question_keywords',
        count: questions.length,
        description: 'Question-based keywords for FAQ content',
        keywords: questions.slice(0, 10).map(k => k.keyword)
      });
    }
    
    return opportunities;
  }

  generateContentSuggestions(data) {
    const suggestions = [];
    
    // Group suggestions by intent
    const intentGroups = {};
    data.intentData.forEach(item => {
      if (!intentGroups[item.primary_intent]) {
        intentGroups[item.primary_intent] = [];
      }
      intentGroups[item.primary_intent].push(item.keyword);
    });
    
    Object.entries(intentGroups).forEach(([intent, keywords]) => {
      suggestions.push({
        content_type: this.getContentTypeForIntent(intent),
        target_keywords: keywords.slice(0, 5),
        intent: intent,
        priority: this.getIntentPriority(intent),
        content_suggestions: this.getContentSuggestionsForIntent(intent)
      });
    });
    
    return suggestions;
  }

  getContentTypeForIntent(intent) {
    const contentTypes = {
      informational: 'Blog posts, guides, tutorials',
      commercial: 'Comparison pages, product reviews',
      transactional: 'Product pages, landing pages',
      navigational: 'Brand pages, category pages'
    };
    return contentTypes[intent] || 'General content';
  }

  getIntentPriority(intent) {
    const priorities = {
      transactional: 'High',
      commercial: 'Medium-High',
      informational: 'Medium',
      navigational: 'Low'
    };
    return priorities[intent] || 'Low';
  }

  getContentSuggestionsForIntent(intent) {
    const suggestions = {
      informational: [
        'Create comprehensive how-to guides',
        'Develop FAQ sections',
        'Write educational blog posts',
        'Create video tutorials'
      ],
      commercial: [
        'Build comparison tables',
        'Write product reviews',
        'Create "best of" lists',
        'Develop case studies'
      ],
      transactional: [
        'Optimize product descriptions',
        'Create compelling landing pages',
        'Add customer testimonials',
        'Include clear pricing information'
      ],
      navigational: [
        'Optimize brand pages',
        'Improve site navigation',
        'Create brand-specific content',
        'Enhance local presence'
      ]
    };
    return suggestions[intent] || [];
  }

  prepareCsvExport(keywords) {
    return keywords.map(k => ({
      keyword: k.keyword,
      search_volume: k.search_volume,
      keyword_difficulty: k.keyword_difficulty,
      cpc: k.cpc,
      competition: k.competition,
      trend: k.trend_direction || 'Stable'
    }));
  }

  generateApiEndpoints(seedKeyword) {
    const slug = seedKeyword.toLowerCase().replace(/\s+/g, '-');
    return {
      full_report: `/api/keywords/${slug}/report`,
      metrics_only: `/api/keywords/${slug}/metrics`,
      serp_analysis: `/api/keywords/${slug}/serp`,
      trends: `/api/keywords/${slug}/trends`,
      related: `/api/keywords/${slug}/related`
    };
  }

  calculateDataFreshness() {
    return {
      search_volume_data: '7 days',
      serp_data: '24 hours',
      trend_data: '30 days',
      competition_data: '3 days'
    };
  }

  cacheResults(keyword, report) {
    const cacheKey = `research_${keyword.toLowerCase().replace(/\s+/g, '_')}`;
    this.cache.set(cacheKey, {
      data: report,
      timestamp: Date.now(),
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  // Batch processing for large keyword lists
  async processBulkKeywords(keywords, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 50;
    
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(keywords.length/batchSize)}`);
      
      const batchResults = await Promise.all(
        batch.map(keyword => this.performKeywordResearch(keyword, options))
      );
      
      results.push(...batchResults);
      
      // Rate limiting between batches
      if (i + batchSize < keywords.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  // Real-time keyword suggestions as user types
  async getKeywordSuggestions(partialKeyword, limit = 10) {
    if (partialKeyword.length < 2) return [];
    
    // Check cache first
    const cacheKey = `suggestions_${partialKeyword.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data;
    }
    
    // Generate suggestions
    const suggestions = await this.dataSourceEngine.getAutocompleteSuggestions(
      partialKeyword, 
      limit
    );
    
    // Add quick metrics for suggestions
    const suggestionsWithMetrics = await Promise.all(
      suggestions.map(async (suggestion) => {
        const quickMetrics = await this.metricsCalculator.getQuickMetrics(suggestion);
        return {
          keyword: suggestion,
          search_volume: quickMetrics.search_volume,
          difficulty: quickMetrics.keyword_difficulty,
          trend: quickMetrics.trend_direction
        };
      })
    );
    
    // Cache suggestions
    this.cache.set(cacheKey, {
      data: suggestionsWithMetrics,
      timestamp: Date.now()
    });
    
    return suggestionsWithMetrics;
  }

  // Competitor keyword analysis
  async analyzeCompetitorKeywords(competitorDomains, options = {}) {
    const results = {};
    
    for (const domain of competitorDomains) {
      console.log(`Analyzing competitor: ${domain}`);
      
      const competitorKeywords = await this.dataSourceEngine.getCompetitorKeywords(
        domain,
        options.limit || 500
      );
      
      const keywordGaps = await this.findKeywordGaps(competitorKeywords);
      const topPerformers = await this.identifyTopPerformingKeywords(competitorKeywords);
      
      results[domain] = {
        total_keywords: competitorKeywords.length,
        estimated_traffic: this.calculateEstimatedTraffic(competitorKeywords),
        keyword_gaps: keywordGaps,
        top_performers: topPerformers,
        content_opportunities: await this.identifyContentOpportunities(competitorKeywords)
      };
    }
    
    return {
      competitor_analysis: results,
      cross_competitor_insights: this.generateCrossCompetitorInsights(results),
      action_items: this.generateCompetitorActionItems(results)
    };
  }

  async findKeywordGaps(competitorKeywords) {
    // Keywords competitors rank for but you don't
    // This would integrate with your own ranking data
    return competitorKeywords
      .filter(k => k.estimated_position <= 10)
      .slice(0, 20)
      .map(k => ({
        keyword: k.keyword,
        competitor_position: k.estimated_position,
        search_volume: k.search_volume,
        gap_opportunity: 'Not ranking'
      }));
  }

  async identifyTopPerformingKeywords(keywords) {
    return keywords
      .filter(k => k.estimated_position <= 5 && k.search_volume > 1000)
      .sort((a, b) => b.estimated_traffic - a.estimated_traffic)
      .slice(0, 15);
  }

  calculateEstimatedTraffic(keywords) {
    return keywords.reduce((total, k) => total + (k.estimated_traffic || 0), 0);
  }

  async identifyContentOpportunities(keywords) {
    // Group keywords by topic/intent for content planning
    const opportunities = {};
    
    keywords.forEach(k => {
      const topic = this.extractMainTopic(k.keyword);
      if (!opportunities[topic]) {
        opportunities[topic] = [];
      }
      opportunities[topic].push(k);
    });
    
    return Object.entries(opportunities)
      .map(([topic, topicKeywords]) => ({
        topic,
        keyword_count: topicKeywords.length,
        total_volume: topicKeywords.reduce((sum, k) => sum + k.search_volume, 0),
        avg_difficulty: topicKeywords.reduce((sum, k) => sum + k.difficulty, 0) / topicKeywords.length,
        content_type: this.suggestContentType(topicKeywords)
      }))
      .sort((a, b) => b.total_volume - a.total_volume);
  }

  extractMainTopic(keyword) {
    // Simple topic extraction - in production, use more sophisticated NLP
    const words = keyword.toLowerCase().split(' ');
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'why', 'when', 'where', 'who'];
    const meaningfulWords = words.filter(word => !stopWords.includes(word) && word.length > 2);
    return meaningfulWords.slice(0, 2).join(' ') || keyword;
  }

  suggestContentType(keywords) {
    const questionKeywords = keywords.filter(k => /^(what|how|why|when|where|who|which)\b/i.test(k.keyword));
    const comparisonKeywords = keywords.filter(k => /\b(best|top|vs|compare|review)\b/i.test(k.keyword));
    
    if (questionKeywords.length > keywords.length * 0.5) return 'FAQ/Guide';
    if (comparisonKeywords.length > keywords.length * 0.3) return 'Comparison/Review';
    return 'General Content';
  }

  generateCrossCompetitorInsights(competitorResults) {
    const insights = [];
    const allKeywords = Object.values(competitorResults).flatMap(r => r.keyword_gaps);
    
    // Find keywords multiple competitors rank for
    const keywordCounts = {};
    allKeywords.forEach(k => {
      keywordCounts[k.keyword] = (keywordCounts[k.keyword] || 0) + 1;
    });
    
    const hotKeywords = Object.entries(keywordCounts)
      .filter(([keyword, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    if (hotKeywords.length > 0) {
      insights.push({
        type: 'hot_keywords',
        description: 'Keywords multiple competitors target',
        keywords: hotKeywords.map(([keyword, count]) => ({ keyword, competitor_count: count }))
      });
    }
    
    return insights;
  }

  generateCompetitorActionItems(competitorResults) {
    const actionItems = [];
    
    // High-priority gaps
    const allGaps = Object.values(competitorResults).flatMap(r => r.keyword_gaps);
    const highVolumeGaps = allGaps.filter(k => k.search_volume > 2000);
    
    if (highVolumeGaps.length > 0) {
      actionItems.push({
        priority: 'High',
        action: 'Target high-volume competitor keywords',
        keywords: highVolumeGaps.slice(0, 5).map(k => k.keyword),
        expected_impact: 'High traffic potential'
      });
    }
    
    return actionItems;
  }
}

// ================================
// 9. SYSTEM ARCHITECTURE & CACHING
// ================================

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalRequests: 0
    };
  }

  get(key) {
    this.cacheStats.totalRequests++;
    
    const cached = this.memoryCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      this.cacheStats.hits++;
      return cached.data;
    }
    
    this.cacheStats.misses++;
    return null;
  }

  set(key, data, ttlMs = 3600000) { // Default 1 hour
    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      created: Date.now()
    });
  }

  delete(key) {
    return this.memoryCache.delete(key);
  }

  clear() {
    this.memoryCache.clear();
    this.cacheStats = { hits: 0, misses: 0, totalRequests: 0 };
  }

  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      cacheSize: this.memoryCache.size
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (now >= value.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// ================================
// 10. API RATE LIMITER
// ================================

class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old requests
    this.requests = this.requests.filter(timestamp => timestamp > oneMinuteAgo);
    
    if (this.requests.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 60000 - (now - oldestRequest);
      
      console.log(`Rate limit exceeded. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      return this.checkLimit(); // Recursive check after waiting
    }
    
    this.requests.push(now);
    return true;
  }
}

// ================================
// 11. EXPORT AND INTEGRATION
// ================================

module.exports = {
  KeywordResearchPlatform,
  DataSourceEngine,
  KeywordMetricsCalculator,
  SERPAnalysisEngine,
  KeywordGroupingEngine,
  SemanticAnalysisEngine,
  TrendAnalysisEngine,
  SERPPositionTracker,
  KeywordIntentClassifier,
  CacheManager,
  RateLimiter,
  DataSourceManager,
  SERPAnalyzer,
  KeywordClusteringEngine,
  SemanticKeywordEngine,
  TrendAnalysisEngine,
};

// Example usage:
/*
const platform = new KeywordResearchPlatform();

// Single keyword research
const report = await platform.performKeywordResearch('digital marketing', {
  maxResults: 1000,
  competitors: ['competitor1.com', 'competitor2.com']
});

// Bulk keyword processing
const bulkResults = await platform.processBulkKeywords([
  'seo tools',
  'keyword research',
  'content marketing'
]);

// Real-time suggestions
const suggestions = await platform.getKeywordSuggestions('digital mark');

// Competitor analysis
const competitorAnalysis = await platform.analyzeCompetitorKeywords([
  'ahrefs.com',
  'semrush.com'
]);
*/