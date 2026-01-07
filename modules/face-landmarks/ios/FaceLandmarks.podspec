Pod::Spec.new do |s|
  s.name           = 'FaceLandmarks'
  s.version        = '1.0.0'
  s.summary        = 'MediaPipe Face Landmarker for Expo'
  s.description    = 'Native module providing MediaPipe Face Landmarker functionality for emotion detection'
  s.author         = 'SkillSpark'
  s.homepage       = 'https://github.com/skillspark'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.0' }
  s.source         = { :git => 'https://github.com/TharunCodes07/SkillSpark.git', :tag => s.version }
  s.swift_version  = '5.4'
  
  s.source_files   = '**/*.swift'
  
  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '~> 0.10.21'
end
